import { prisma } from "@/lib/db/prisma";
import { OrgRole, ProjectRole } from "@/types";

// ============================================================================
// ORGANIZATION-LEVEL PERMISSIONS
// ============================================================================

/**
 * Check if user is an organization admin
 */
export async function isOrgAdmin(orgId: string, userId: string): Promise<boolean> {
    const orgMember = await prisma.orgMember.findUnique({
        where: {
            orgId_userId: {
                orgId,
                userId,
            },
        },
        select: {
            role: true,
        },
    });
    return orgMember?.role === OrgRole.ADMIN;
}

/**
 * Require user to be an organization admin
 */
export async function requireOrgAdmin(orgId: string, userId: string) {
    const isAdmin = await isOrgAdmin(orgId, userId);
    if (!isAdmin) {
        throw new Error("Organization admin access required");
    }
}

/**
 * Check if user is a member of an organization
 */
export async function isOrgMember(orgId: string, userId: string): Promise<boolean> {
    const orgMember = await prisma.orgMember.findUnique({
        where: {
            orgId_userId: {
                orgId,
                userId,
            },
        },
        select: {
            status: true,
        },
    });

    if (!orgMember) {
        return false;
    }

    const isActive = ["ACTIVE", "PENDING_TEAM_ASSIGNMENT"].includes(orgMember.status);
    return isActive;
}

/**
 * Require user to be an organization member
 */
export async function requireOrgMember(orgId: string, userId: string) {
    const isMember = await isOrgMember(orgId, userId);
    if (!isMember) {
        throw new Error("Not a member of this organization");
    }
}

// ============================================================================
// TEAM-LEVEL PERMISSIONS
// ============================================================================

/**
 * Get all team IDs that a user belongs to in an organization
 */
export async function getUserTeams(orgId: string, userId: string): Promise<string[]> {
    const teamMemberships = await prisma.teamMember.findMany({
        where: {
            orgId,
            userId,
        },
        select: {
            teamId: true,
        },
    });
    return teamMemberships.map((tm: any) => tm.teamId);
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
    // Get project with orgId and ownerId
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { orgId: true, ownerId: true },
    });

    if (!project) {
        return false;
    }

    // 1. Check if user is org admin (bypass all restrictions)
    if (await isOrgAdmin(project.orgId, userId)) {
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

    // 4. [NEW POLICY] Any active member of the organization can view any project
    if (await isOrgMember(project.orgId, userId)) {
        return true;
    }

    return false;
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
    // Get project with orgId and ownerId
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { orgId: true, ownerId: true },
    });

    if (!project) {
        return false;
    }

    // 1. Check if user is org admin (bypass all restrictions)
    if (await isOrgAdmin(project.orgId, userId)) {
        return true;
    }

    // 2. Check if user is project owner
    if (project.ownerId === userId) {
        return true;
    }

    // 4. [NEW POLICY] Any active member of the organization can edit the ONBOARDING project
    if (projectId === "onboarding-project-id" && await isOrgMember(project.orgId, userId)) {
        return true;
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

    // 1. Org admins have PROJECT_ADMIN role (effectively OWNER)
    if (await isOrgAdmin(project.orgId, userId)) {
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

    // 4. [NEW POLICY] Onboarding project gives PROJECT_ADMIN to all org members
    if (projectId === "onboarding-project-id") {
        if (await isOrgMember(project.orgId, userId)) {
            return ProjectRole.PROJECT_ADMIN;
        }
    }

    // 5. [NEW POLICY] Any org member is at least a VIEWER
    if (!highestRole) {
        if (await isOrgMember(project.orgId, userId)) {
            highestRole = ProjectRole.VIEWER;
        }
    }

    // 6. Check team-based roles
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

        const roles = projectTeams.map((pt: any) => pt.role as ProjectRole);

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
