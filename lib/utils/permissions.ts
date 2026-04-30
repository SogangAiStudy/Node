import { prisma } from "@/lib/db/prisma";
import { OrgRole, ProjectRole } from "@/types";

export const ACTIVE_ORG_MEMBER_STATUSES = ["ACTIVE", "PENDING_TEAM_ASSIGNMENT"] as const;

function isActiveOrgStatus(status: string) {
    return ACTIVE_ORG_MEMBER_STATUSES.includes(status as (typeof ACTIVE_ORG_MEMBER_STATUSES)[number]);
}

export async function getOrgMembership(orgId: string, userId: string) {
    return prisma.orgMember.findUnique({
        where: {
            orgId_userId: {
                orgId,
                userId,
            },
        },
        select: {
            orgId: true,
            userId: true,
            role: true,
            status: true,
        },
    });
}

export async function getActiveOrgMembership(orgId: string, userId: string) {
    const membership = await getOrgMembership(orgId, userId);
    return membership && isActiveOrgStatus(membership.status) ? membership : null;
}

// ============================================================================
// ORGANIZATION-LEVEL PERMISSIONS
// ============================================================================

/**
 * Check if user is an organization admin
 */
export async function isOrgAdmin(orgId: string, userId: string): Promise<boolean> {
    const orgMember = await getActiveOrgMembership(orgId, userId);
    return orgMember?.role === OrgRole.ADMIN;
}

/**
 * Require user to be an organization admin
 */
export async function requireOrgAdmin(orgId: string, userId: string) {
    const membership = await getActiveOrgMembership(orgId, userId);
    if (!membership || membership.role !== OrgRole.ADMIN) {
        throw new Error("Organization admin access required");
    }
    return membership;
}

/**
 * Check if user is a member of an organization
 */
export async function isOrgMember(orgId: string, userId: string): Promise<boolean> {
    const orgMember = await getActiveOrgMembership(orgId, userId);
    return !!orgMember;
}

/**
 * Require user to be an organization member
 */
export async function requireOrgMember(orgId: string, userId: string) {
    const membership = await getActiveOrgMembership(orgId, userId);
    if (!membership) {
        throw new Error("Not a member of this organization");
    }
    return membership;
}

// ============================================================================
// TEAM-LEVEL PERMISSIONS
// ============================================================================

/**
 * Get all team IDs that a user belongs to in an organization
 */
export async function getUserTeams(orgId: string, userId: string): Promise<string[]> {
    const membership = await getActiveOrgMembership(orgId, userId);
    if (!membership) {
        return [];
    }

    const teamMemberships = await prisma.teamMember.findMany({
        where: {
            orgId,
            userId,
        },
        select: {
            teamId: true,
        },
    });
    return teamMemberships.map((tm) => tm.teamId);
}

/**
 * Check if user is a member of a specific team
 */
export async function isTeamMember(teamId: string, userId: string): Promise<boolean> {
    const teamMember = await prisma.teamMember.findFirst({
        where: {
            teamId,
            userId,
        },
    });
    return !!teamMember;
}

// ============================================================================
// PROJECT-LEVEL PERMISSIONS (ProjectTeam-based)
// ============================================================================

/**
 * Check if user can view a project
 */
export async function canViewProject(projectId: string, userId: string): Promise<boolean> {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { orgId: true, ownerId: true },
    });

    if (!project) {
        return false;
    }

    const orgMembership = await getActiveOrgMembership(project.orgId, userId);

    if (!orgMembership) {
        return false;
    }

    // 1. Check if user is org admin (bypass all restrictions)
    if (orgMembership.role === OrgRole.ADMIN) {
        return true;
    }

    // 2. Check if user is the project owner
    if (project.ownerId === userId) {
        return true;
    }

    // 3. Check if user is an explicit project member
    const projectMember = await prisma.projectMember.findUnique({
        where: {
            projectId_userId: {
                projectId,
                userId,
            },
        },
    });
    if (projectMember) {
        return true;
    }

    // 4. Check team-based project access
    const myTeams = await getUserTeams(project.orgId, userId);

    if (myTeams.length === 0) {
        return false;
    }

    const teamAccess = await prisma.projectTeam.findFirst({
        where: {
            projectId,
            teamId: { in: myTeams },
        },
        select: { id: true },
    });

    return !!teamAccess;
}

/**
 * Require user to have view access to a project
 */
export async function requireProjectView(projectId: string, userId: string) {
    const canView = await canViewProject(projectId, userId);
    if (!canView) {
        throw new Error("Not authorized to view this project");
    }
}

/**
 * Check if user can edit a project
 */
export async function canEditProject(projectId: string, userId: string): Promise<boolean> {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { orgId: true, ownerId: true },
    });

    if (!project) {
        return false;
    }

    const orgMembership = await getActiveOrgMembership(project.orgId, userId);

    if (!orgMembership) {
        return false;
    }

    // 1. Check if user is org admin (bypass all restrictions)
    if (orgMembership.role === OrgRole.ADMIN) {
        return true;
    }

    // 2. Check if user is project owner
    if (project.ownerId === userId) {
        return true;
    }

    // 3. Check if user is an explicit project member with EDITOR or higher role
    const projectMember = await prisma.projectMember.findUnique({
        where: {
            projectId_userId: {
                projectId,
                userId,
            },
        },
        select: { role: true },
    });

    if (projectMember && (
        projectMember.role === ProjectRole.EDITOR ||
        projectMember.role === ProjectRole.PROJECT_ADMIN ||
        projectMember.role === ProjectRole.OWNER
    )) {
        return true;
    }

    // 4. Check team-based roles
    const myTeams = await getUserTeams(project.orgId, userId);

    if (myTeams.length > 0) {
        const projectTeams = await prisma.projectTeam.findMany({
            where: {
                projectId,
                teamId: {
                    in: myTeams,
                },
            },
            select: {
                role: true,
            },
        });

        const hasEditRole = projectTeams.some((pt) =>
            pt.role === ProjectRole.EDITOR ||
            pt.role === ProjectRole.PROJECT_ADMIN ||
            pt.role === ProjectRole.OWNER
        );

        if (hasEditRole) {
            return true;
        }
    }

    return false;
}

/**
 * Require user to have edit access to a project
 */
export async function requireProjectEdit(projectId: string, userId: string) {
    const canEdit = await canEditProject(projectId, userId);
    if (!canEdit) {
        throw new Error("Not authorized to edit this project");
    }
}

/**
 * Get user's highest project role for a project
 * Returns null if user has no access
 */
export async function getUserProjectRole(
    projectId: string,
    userId: string
): Promise<ProjectRole | null> {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { orgId: true, ownerId: true },
    });

    if (!project) {
        return null;
    }

    const orgMembership = await getActiveOrgMembership(project.orgId, userId);

    if (!orgMembership) {
        return null;
    }

    // 1. Org admins have PROJECT_ADMIN role (effectively OWNER)
    if (orgMembership.role === OrgRole.ADMIN) {
        return ProjectRole.PROJECT_ADMIN;
    }

    // 2. Project owner has PROJECT_ADMIN role (effectively OWNER)
    if (project.ownerId === userId) {
        return ProjectRole.PROJECT_ADMIN;
    }

    // 3. Check for explicit project membership
    const projectMember = await prisma.projectMember.findUnique({
        where: {
            projectId_userId: {
                projectId,
                userId,
            },
        },
        select: { role: true },
    });

    let highestRole: ProjectRole | null = projectMember ? projectMember.role : null;

    // 4. Check team-based roles
    const myTeams = await getUserTeams(project.orgId, userId);

    if (myTeams.length > 0) {
        const projectTeams = await prisma.projectTeam.findMany({
            where: {
                projectId,
                teamId: {
                    in: myTeams,
                },
            },
            select: {
                role: true,
            },
        });

        const roles = projectTeams.map((pt) => pt.role);

        if (roles.includes(ProjectRole.OWNER)) return ProjectRole.OWNER;
        if (roles.includes(ProjectRole.PROJECT_ADMIN)) return ProjectRole.PROJECT_ADMIN;

        // If current highest is not ADMIN/OWNER, maybe upgrade to EDITOR
        if (!highestRole || highestRole === ProjectRole.VIEWER) {
            if (roles.includes(ProjectRole.EDITOR)) highestRole = ProjectRole.EDITOR;
        }

        // If still null, check for VIEWER
        if (!highestRole) {
            if (roles.includes(ProjectRole.VIEWER)) highestRole = ProjectRole.VIEWER;
        }
    }

    return highestRole;
}

/**
 * Check if user is a project admin (Owner, PROJECT_ADMIN role, or Org Admin)
 */
export async function isProjectAdmin(projectId: string, userId: string): Promise<boolean> {
    const role = await getUserProjectRole(projectId, userId);
    return role === ProjectRole.PROJECT_ADMIN || role === ProjectRole.OWNER;
}
