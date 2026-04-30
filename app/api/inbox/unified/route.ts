import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, getUserTeams } from "@/lib/utils/auth";
import { buildTeamRequestFilters, requestDetailsInclude, toRequestDTO } from "@/lib/utils/requests";
import { InboxItem } from "@/types";
import type { Notification, OrgMember, User } from "@prisma/client";

type JoinRequestWithUser = OrgMember & { user: Pick<User, "name" | "email"> };

export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth();
        const searchParams = request.nextUrl.searchParams;
        const orgId = searchParams.get("orgId");

        if (!orgId) {
            return NextResponse.json({ error: "orgId is required" }, { status: 400 });
        }

        // Verify membership
        const membership = await prisma.orgMember.findUnique({
            where: { orgId_userId: { orgId, userId: user.id } },
        });

        if (!membership) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        if (!["ACTIVE", "PENDING_TEAM_ASSIGNMENT"].includes(membership.status)) {
            return NextResponse.json({ error: "Inactive members cannot access this inbox" }, { status: 403 });
        }

        const isAdmin = membership.role === "ADMIN";
        const myTeamIds = await getUserTeams(orgId, user.id);
        const myTeams = await prisma.team.findMany({
            where: { id: { in: myTeamIds } },
            select: { name: true }
        });
        const myTeamNames = myTeams.flatMap((team) => (team.name ? [team.name] : []));
        const requestTargets: Prisma.RequestWhereInput[] = [{ toUserId: user.id }];
        const notificationTargets: Prisma.NotificationWhereInput[] = [{ userId: user.id }];

        requestTargets.push(...buildTeamRequestFilters(myTeamIds, myTeamNames));

        if (myTeamIds.length > 0) {
            notificationTargets.push({
                targetType: "TEAM",
                targetTeamId: { in: myTeamIds }
            });
        }

        // 1. Fetch Requests (personal + team)
        const requests = await prisma.request.findMany({
            where: {
                orgId,
                isArchived: false,
                OR: requestTargets
            },
            include: {
                ...requestDetailsInclude,
            },
            orderBy: { createdAt: "desc" },
        });

        // 2. Fetch Project Invites (pending)
        const invites = await prisma.projectInvite.findMany({
            where: { orgId, targetUserId: user.id, status: "PENDING" },
            include: {
                project: { select: { name: true } },
                invitedBy: { select: { name: true } },
            },
        });

        // 3. Fetch Notifications (personal + team)
        let notifications: Notification[] = [];
        try {
            notifications = await prisma.notification.findMany({
                where: {
                    orgId,
                    OR: notificationTargets
                },
                orderBy: { createdAt: "desc" },
                take: 50
            });
        } catch (err) {
            console.error("Failed to fetch notifications:", err);
            // Non-blocking failure for inbox
        }

        // 4. Fetch Join Requests (if admin)
        let joinRequests: JoinRequestWithUser[] = [];
        if (isAdmin) {
            joinRequests = await prisma.orgMember.findMany({
                where: { orgId, status: "PENDING_APPROVAL" },
                include: { user: { select: { name: true, email: true } } },
            });
        }

        // --- Map to DTOs and Combine ---
        const items: InboxItem[] = [];

        // Map Requests
        requests.forEach(req => {
            items.push({
                type: "REQUEST",
                data: {
                    ...toRequestDTO(req),
                }
            });
        });

        // Map Invites
        invites.forEach(inv => {
            items.push({
                type: "INVITE",
                data: {
                    id: inv.id,
                    orgId: inv.orgId,
                    projectId: inv.projectId,
                    projectName: inv.project.name,
                    invitedByUserId: inv.invitedByUserId,
                    invitedByUserName: inv.invitedBy.name || "System",
                    targetUserId: inv.targetUserId,
                    role: inv.role,
                    status: inv.status,
                    createdAt: inv.createdAt.toISOString(),
                }
            });
        });

        const notificationEntityIds = notifications.flatMap((n) => n.entityId ? [n.entityId] : []);
        const [notificationNodes, notificationProjects] = await Promise.all([
            notificationEntityIds.length > 0
                ? prisma.node.findMany({
                    where: { id: { in: notificationEntityIds } },
                    select: { id: true, projectId: true },
                })
                : Promise.resolve([]),
            notificationEntityIds.length > 0
                ? prisma.project.findMany({
                    where: { id: { in: notificationEntityIds } },
                    select: { id: true },
                })
                : Promise.resolve([]),
        ]);
        const notificationNodeProjectMap = new Map(notificationNodes.map((node) => [node.id, node.projectId]));
        const notificationProjectIds = new Set(notificationProjects.map((project) => project.id));

        // Map Notifications
        notifications.forEach((n) => {
            const projectId =
                n.entityId && notificationNodeProjectMap.has(n.entityId)
                    ? notificationNodeProjectMap.get(n.entityId) || null
                    : n.entityId && notificationProjectIds.has(n.entityId)
                        ? n.entityId
                        : null;

            items.push({
                type: "NOTIFICATION",
                data: {
                    id: n.id,
                    userId: n.userId,
                    orgId: n.orgId,
                    projectId,
                    type: n.type,
                    targetType: n.targetType,
                    targetTeamId: n.targetTeamId,
                    title: n.title,
                    message: n.message,
                    entityId: n.entityId,
                    isRead: n.isRead,
                    createdAt: n.createdAt.toISOString(),
                }
            });
        });

        // Map Join Requests
        joinRequests.forEach(m => {
            items.push({
                type: "JOIN_REQUEST",
                data: {
                    id: m.id,
                    orgId: m.orgId,
                    userId: m.userId,
                    userName: m.user.name,
                    userEmail: m.user.email,
                    role: m.role,
                    status: m.status,
                    createdAt: m.createdAt.toISOString(),
                }
            });
        });

        // Sort all by createdAt desc
        items.sort((a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime());

        return NextResponse.json({ items });
    } catch (error) {
        console.error("GET /api/inbox/unified error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
