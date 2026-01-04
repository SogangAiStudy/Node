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
export * from "./permissions";
