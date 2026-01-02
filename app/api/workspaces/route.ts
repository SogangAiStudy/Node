import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

// GET /api/workspaces - Get all user's workspaces with unread inbox indicator
export async function GET() {
  try {
    const user = await requireAuth();
    console.log(`[DEBUG] GET /api/workspaces - User: ${user.email} (${user.id})`);

    // Get all organizations where user is a member (any status)
    let orgMemberships = await prisma.orgMember.findMany({
      where: {
        userId: user.id,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // AUTO-PROVISIONING: If user has no workspaces, create a personal one (Notion style)
    if (orgMemberships.length === 0) {
      console.log(`[DEBUG] No workspaces found for ${user.email}. Creating personal workspace...`);

      // CRITICAL: Ensure user exists in database before creating organization
      // NextAuth session may contain user data before the user is created in our DB
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
      });

      if (!dbUser) {
        console.log(`[DEBUG] User ${user.email} not found in database. This should not happen with NextAuth setup.`);
        return NextResponse.json(
          { error: "User not found in database. Please sign out and sign in again." },
          { status: 500 }
        );
      }

      const personalOrg = await prisma.$transaction(async (tx: any) => {
        // 1. Create the Personal Workspace (Organization)
        const org = await tx.organization.create({
          data: {
            name: `${user.name || "Personal"}'s Space`,
            ownerId: user.id,
          },
        });

        // 2. Create the Admin Membership
        await tx.orgMember.create({
          data: {
            orgId: org.id,
            userId: user.id,
            role: "ADMIN",
            status: "ACTIVE",
          },
        });

        // 3. Create a Default 'Personal' Team
        const team = await tx.team.create({
          data: {
            orgId: org.id,
            name: "Personal",
            description: "Your private space",
          },
        });

        // 4. Join the team
        await tx.teamMember.create({
          data: {
            orgId: org.id,
            teamId: team.id,
            userId: user.id,
            role: "LEAD",
          },
        });

        // 5. Create a 'Getting Started' Project
        const project = await tx.project.create({
          data: {
            orgId: org.id,
            ownerId: user.id,
            name: "👋 Getting Started",
            description: "A quick guide to using Node",
            primaryTeamId: team.id,
          },
        });

        // 6. Link project to team
        await tx.projectTeam.create({
          data: {
            orgId: org.id,
            projectId: project.id,
            teamId: team.id,
            role: "PROJECT_ADMIN",
          },
        });

        // 7. Add dummy content
        const node = await tx.node.create({
          data: {
            orgId: org.id,
            projectId: project.id,
            title: "Explore Graph View",
            description: "Welcome to your new workspace! Click on the 'Graph' tab to see your project structure.",
            type: "TASK",
            manualStatus: "TODO",
            teamId: team.id,
          },
        });

        return org;
      });

      // Re-fetch memberships to include the new one (with status)
      orgMemberships = await prisma.orgMember.findMany({
        where: {
          userId: user.id,
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    }

    console.log(`[DEBUG] GET /api/workspaces - Found ${orgMemberships.length} memberships`);

    // For each org, check if there are unread inbox items
    const workspaces = await Promise.all(
      orgMemberships.map(async (membership: { orgId: string; status: string; organization: { id: string; name: string } }) => {
        const orgId = membership.orgId;

        // Only check for unread requests for active-ish members
        // Inbox state feature disabled for now
        let hasUnreadInbox = false;
        const lastSeenAt = null;

        if (["ACTIVE", "PENDING_TEAM_ASSIGNMENT"].includes(membership.status)) {

          // Get user's teams in this org
          const userTeams = await prisma.teamMember.findMany({
            where: {
              orgId,
              userId: user.id,
            },
            select: {
              team: {
                select: {
                  name: true,
                },
              },
            },
          });

          const teamNames = userTeams.map((tm: { team: { name: string } }) => tm.team.name);

          // Check for unread requests
          const unreadCount = await prisma.request.findMany({
            where: {
              orgId,
              OR: [
                { toUserId: user.id },
                { toTeam: { in: teamNames } },
              ],
              status: {
                not: "CLOSED",
              },
            },
            select: {
              id: true,
            },
          });

          hasUnreadInbox = unreadCount.length > 0;
        }

        return {
          orgId: membership.organization.id,
          name: membership.organization.name,
          status: membership.status,
          hasUnreadInbox,
        };
      })
    );

    console.log(`[DEBUG] GET /api/workspaces - Returning ${workspaces.length} workspaces:`, JSON.stringify(workspaces));
    return NextResponse.json(workspaces);
  } catch (error) {
    console.error("GET /api/workspaces error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspaces" },
      { status: 500 }
    );
  }
}
