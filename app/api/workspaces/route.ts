import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

/**
 * Check if an organization has unread inbox items for a user
 */
async function checkHasUnreadInbox(orgId: string, userId: string): Promise<boolean> {
  const inboxState = await prisma.orgInboxState.findUnique({
    where: {
      orgId_userId: {
        orgId,
        userId,
      },
    },
  });

  const lastSeenAt = inboxState?.lastSeenAt || new Date(0);

  // Get user's teams in this org
  const userTeams = await prisma.teamMember.findMany({
    where: {
      orgId,
      userId,
    },
    select: {
      team: {
        select: {
          name: true,
        },
      },
    },
  });

  const teamNames = userTeams.map((tm: any) => tm.team.name);

  // Check for unread requests
  const unreadCount = await prisma.request.findMany({
    where: {
      orgId,
      OR: [
        { toUserId: userId },
        { toTeam: { in: teamNames } },
      ],
      status: {
        not: "CLOSED",
      },
      createdAt: {
        gt: lastSeenAt,
      },
    },
    select: {
      id: true,
    },
  });

  return unreadCount.length > 0;
}

// GET /api/workspaces - Get all user's workspaces with unread inbox indicator
export async function GET(request: NextRequest) {
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

      let dbUser = await prisma.user.findUnique({
        where: { id: user.id },
      });

      if (!dbUser) {
        console.log(`[DEBUG] User ${user.email} not found by ID: ${user.id}. Checking by email...`);
        const existingByEmail = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (existingByEmail) {
          const oldId = existingByEmail.id;
          const newId = user.id;
          console.log(`[DEBUG] Found user by email with different ID: ${oldId}. Re-syncing ID to ${newId}...`);

          try {
            // STRATEGY: Create New -> Move Relations -> Delete Old
            // We cannot update ID directly due to FK constraints on many tables.
            // 1. Rename old user's email to free it up
            const tempEmail = `temp-${oldId}-${Date.now()}@migration.local`;
            await prisma.user.update({
              where: { id: oldId },
              data: { email: tempEmail },
            });

            // 2. Create the new user with the correct ID and Email
            dbUser = await prisma.user.create({
              data: {
                id: newId,
                email: user.email!,
                name: user.name || existingByEmail.name,
                image: user.image || existingByEmail.image,
              },
            });

            // 3. Move all related records to the new ID
            // Org Ownership
            await prisma.organization.updateMany({
              where: { ownerId: oldId },
              data: { ownerId: newId },
            });

            // Org Memberships
            await prisma.orgMember.updateMany({
              where: { userId: oldId },
              data: { userId: newId },
            });

            // Team Memberships
            await prisma.teamMember.updateMany({
              where: { userId: oldId },
              data: { userId: newId },
            });

            // Project Ownership
            await prisma.project.updateMany({
              where: { ownerId: oldId },
              data: { ownerId: newId },
            });

            // Project Memberships
            await prisma.projectMember.updateMany({
              where: { userId: oldId },
              data: { userId: newId },
            });

            // Project Invites (Invited By & Target)
            await prisma.projectInvite.updateMany({
              where: { invitedByUserId: oldId },
              data: { invitedByUserId: newId },
            });
            await prisma.projectInvite.updateMany({
              where: { targetUserId: oldId },
              data: { targetUserId: newId },
            });

            // Node Ownership & Requests
            await prisma.node.updateMany({
              where: { ownerId: oldId },
              data: { ownerId: newId },
            });

            await prisma.nodeOwner.updateMany({
              where: { userId: oldId },
              data: { userId: newId },
            });

            await prisma.request.updateMany({
              where: { fromUserId: oldId },
              data: { fromUserId: newId },
            });
            await prisma.request.updateMany({
              where: { toUserId: oldId },
              data: { toUserId: newId },
            });
            await prisma.request.updateMany({
              where: { approvedById: oldId },
              data: { approvedById: newId },
            });

            // Logs & Inbox
            await prisma.activityLog.updateMany({
              where: { userId: oldId },
              data: { userId: newId },
            });

            await prisma.orgInboxState.updateMany({
              where: { userId: oldId },
              data: { userId: newId },
            });

            console.log(`[DEBUG] Migrated all data from ${oldId} to ${newId}`);

            // 4. Delete the old user
            await prisma.user.delete({
              where: { id: oldId },
            });

            console.log(`[DEBUG] Sync complete. Old user ${oldId} deleted.`);

            // CRITICAL: Re-check memberships after sync
            const syncedMemberships = await prisma.orgMember.findMany({
              where: {
                userId: newId,
                status: { in: ["ACTIVE", "PENDING_TEAM_ASSIGNMENT"] },
              },
              include: {
                organization: {
                  select: { id: true, name: true },
                },
              },
            });

            if (syncedMemberships.length > 0) {
              const workspaces = await Promise.all(
                syncedMemberships.map(async (m) => {
                  const hasUnread = await checkHasUnreadInbox(m.orgId, newId);
                  return {
                    orgId: m.orgId,
                    name: m.organization.name,
                    status: m.status,
                    hasUnreadInbox: hasUnread,
                  };
                })
              );
              return NextResponse.json(workspaces);
            }

          } catch (syncError) {
            console.error("[DEBUG] Failed to re-sync user ID, using existing record as fallback:", syncError);
            // Fallback: use the existing user (old ID)
            dbUser = existingByEmail;

            // Revert email change if needed (best effort)
            try {
              // If we created the new user but failed later, effectively we have a partial state?
              // This is risky without a transaction. 
              // However, since we returned dbUser = existingByEmail, we should try to restore email if possible or just proceed.
              // If we changed the email to temp, subsequent logins will fail lookup by email.
              // Critical: We must revert the email change if we didn't delete the user.
              await prisma.user.update({
                where: { id: oldId },
                data: { email: user.email! }
              }).catch(() => { });
            } catch (e) { }
          }
        } else {
          console.log(`[DEBUG] User ${user.email} not found. Attempting to create...`);
          try {
            dbUser = await prisma.user.create({
              data: {
                id: user.id,
                name: user.name || null,
                email: user.email!,
                image: user.image || null,
              },
            });
          } catch (createError) {
            console.error("[DEBUG] Failed to auto-create user:", createError);
            return NextResponse.json(
              { error: "User not found and could not be created." },
              { status: 500 }
            );
          }
        }
      }

      // Ensure we have a valid dbUser before proceeding
      const validUserId = dbUser?.id || user.id;

      const personalOrg = await prisma.$transaction(async (tx: any) => {
        // 1. Create the Personal Workspace (Organization) with invite code
        const org = await tx.organization.create({
          data: {
            name: `${user.name || "Personal"}'s Space`,
            ownerId: validUserId, // Use the VALID database ID
            inviteCode: crypto.randomUUID(),
          },
        });

        // 2. Create the Admin Membership
        await tx.orgMember.create({
          data: {
            orgId: org.id,
            userId: validUserId,
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
        await tx.node.create({
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

      // Re-fetch memberships to include the new one
      orgMemberships = await prisma.orgMember.findMany({
        where: { userId: user.id },
        include: {
          organization: {
            select: { id: true, name: true },
          },
        },
      });
    }

    console.log(`[DEBUG] GET /api/workspaces - Found ${orgMemberships.length} memberships`);

    // For each org, check if there are unread inbox items
    const workspaces = await Promise.all(
      orgMemberships.map(async (m: any) => {
        let hasUnreadInbox = false;
        if (["ACTIVE", "PENDING_TEAM_ASSIGNMENT"].includes(m.status)) {
          hasUnreadInbox = await checkHasUnreadInbox(m.orgId, user.id);
        }
        return {
          orgId: m.orgId,
          name: m.organization.name,
          status: m.status,
          hasUnreadInbox,
        };
      })
    );

    console.log(`[DEBUG] GET /api/workspaces - Returning ${workspaces.length} workspaces`);
    return NextResponse.json(workspaces);
  } catch (error) {
    console.error("GET /api/workspaces error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspaces" },
      { status: 500 }
    );
  }
}
