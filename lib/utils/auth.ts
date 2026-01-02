import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { OrgRole, ProjectRole } from "@/types";

/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user;
}

/**
 * Get the current user's ID or throw an error
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user?.id) {
    throw new Error("Unauthorized");
  }
  return user;
}

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
    console.log(`[DEBUG] isOrgMember - User ${userId} is NOT a member of org ${orgId}`);
    return false;
  }

  const isActive = ["ACTIVE", "PENDING_TEAM_ASSIGNMENT"].includes(orgMember.status);
  if (!isActive) {
    console.log(`[DEBUG] isOrgMember - User ${userId} has status ${orgMember.status} in org ${orgId}`);
  }

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
 * Check if user can view a project (based on ProjectTeam intersection)
 *
 * Rules:
 * - Org ADMINs can view all projects
 * - Users can view if any of their teams are in the project's ProjectTeam list
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

  // 4. Check team-based access
  // Get user's teams
  const myTeams = await getUserTeams(project.orgId, userId);

  if (myTeams.length > 0) {
    // Get teams that have access to this project
    const projectTeams = await prisma.projectTeam.findMany({
      where: {
        projectId,
        teamId: {
          in: myTeams,
        },
      },
      select: {
        teamId: true,
      },
    });

    if (projectTeams.length > 0) {
      return true;
    }
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
 *
 * Rules:
 * - Org ADMINs can edit all projects
 * - Users can edit if any of their teams has EDITOR or PROJECT_ADMIN role
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

  // 3. Check team-based access
  // Get user's teams
  const myTeams = await getUserTeams(project.orgId, userId);

  if (myTeams.length > 0) {
    // Get teams with EDITOR or PROJECT_ADMIN access
    const projectTeams = await prisma.projectTeam.findMany({
      where: {
        projectId,
        teamId: {
          in: myTeams,
        },
        role: {
          in: [ProjectRole.EDITOR, ProjectRole.PROJECT_ADMIN],
        },
      },
    });

    if (projectTeams.length > 0) {
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

  // 1. Org admins have PROJECT_ADMIN role
  if (await isOrgAdmin(project.orgId, userId)) {
    return ProjectRole.PROJECT_ADMIN;
  }

  // 2. Project owner has PROJECT_ADMIN role
  if (project.ownerId === userId) {
    return ProjectRole.PROJECT_ADMIN;
  }

  // 3. Check for explicit project membership (default to VIEWER if no higher role found)
  const projectMember = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
  });

  let highestRole: ProjectRole | null = projectMember ? ProjectRole.VIEWER : null;

  // 4. Check team-based roles
  // Get user's teams
  const myTeams = await getUserTeams(project.orgId, userId);

  if (myTeams.length > 0) {
    // Get all project team roles for user's teams
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

    const roles = projectTeams.map((pt: any) => pt.role);

    if (roles.includes(ProjectRole.PROJECT_ADMIN)) {
      return ProjectRole.PROJECT_ADMIN;
    }
    if (roles.includes(ProjectRole.EDITOR)) {
      return ProjectRole.EDITOR;
    }
    if (roles.includes(ProjectRole.VIEWER)) {
      highestRole = ProjectRole.VIEWER;
    }
  }

  return highestRole;
}

// ============================================================================
// LEGACY FUNCTIONS (Deprecated - for migration compatibility)
// ============================================================================

/**
 * Check if user is a member of a project
 * @deprecated Use canViewProject instead
 */
export async function checkProjectMembership(projectId: string, userId: string): Promise<boolean> {
  return canViewProject(projectId, userId);
}

/**
 * Require user to be a member of a project or throw
 * @deprecated Use requireProjectView instead
 */
export async function requireProjectMembership(projectId: string, userId: string) {
  const isMember = await canViewProject(projectId, userId);
  if (!isMember) {
    throw new Error("Not a member of this project");
  }
}

/**
 * Get user's team in a project
 * @deprecated Teams are now managed via TeamMember, not per-project
 */
export async function getUserTeam(projectId: string, userId: string): Promise<string | null> {
  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
    select: {
      team: true,
    },
  });
  return membership?.team || null;
}
