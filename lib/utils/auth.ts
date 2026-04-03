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

  if (user?.id) {
    return user;
  }

  if (user?.email) {
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });

    if (dbUser) {
      return {
        ...user,
        id: dbUser.id,
      };
    }
  }

  throw new Error("Unauthorized");
}

// ============================================================================
// ORGANIZATION-LEVEL PERMISSIONS
// ============================================================================

/**
 * Check if user is an organization admin
 */
export * from "./permissions";
