import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

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

/**
 * Check if user is a member of a project
 */
export async function checkProjectMembership(projectId: string, userId: string): Promise<boolean> {
  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
  });
  return !!membership;
}

/**
 * Require user to be a member of a project or throw
 */
export async function requireProjectMembership(projectId: string, userId: string) {
  const isMember = await checkProjectMembership(projectId, userId);
  if (!isMember) {
    throw new Error("Not a member of this project");
  }
}

/**
 * Get user's team in a project
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
