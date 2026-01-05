import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, getUserTeams } from "@/lib/utils/auth";
import {
    RequestDTO,
    NotificationDTO,
    ProjectInviteDTO,
    OrgMemberDTO,
    InboxItem,
    UnifiedInboxDTO
} from "@/types";

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

        const isAdmin = membership.role === "ADMIN";
        const myTeamIds = await getUserTeams(orgId, user.id);
        const myTeams = await prisma.team.findMany({
            where: { id: { in: myTeamIds } },
            select: { name: true }
        });
        const myTeamNames = myTeams.map(t => t.name);

        // 1. Fetch Requests (personal + team)
        const requests = await prisma.request.findMany({
            where: {
                orgId,
                isArchived: false,
                OR: [
                    { toUserId: user.id },
                    { toTeam: { in: myTeamNames } }
                ]
            },
            include: {
                linkedNode: { select: { title: true } },
                fromUser: { select: { name: true } },
                toUser: { select: { name: true } },
                approvedBy: { select: { name: true } },
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
        let notifications: any[] = [];
        try {
            notifications = await prisma.notification.findMany({
                where: {
                    orgId,
                    OR: [
                        { userId: user.id },
                        {
                            targetType: "TEAM",
                            targetTeamId: { in: myTeamIds }
                        }
                    ]
                },
                orderBy: { createdAt: "desc" },
                take: 50
            });
        } catch (err) {
            console.error("Failed to fetch notifications:", err);
            // Non-blocking failure for inbox
        }

        // 4. Fetch Join Requests (if admin)
        let joinRequests: any[] = [];
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
                    id: req.id,
                    orgId: req.orgId,
                    projectId: req.projectId,
                    linkedNodeId: req.linkedNodeId,
                    linkedNodeTitle: req.linkedNode.title,
                    question: req.question,
                    fromUserId: req.fromUserId,
                    fromUserName: req.fromUser.name || "Unknown",
                    toUserId: req.toUserId,
                    toUserName: req.toUser?.name || null,
                    toTeam: req.toTeam,
                    status: req.status,
                    responseDraft: req.responseDraft,
                    responseFinal: req.responseFinal,
                    approvedById: req.approvedById,
                    approvedByName: req.approvedBy?.name || null,
                    approvedAt: req.approvedAt?.toISOString() || null,
                    claimedAt: req.claimedAt?.toISOString() || null,
                    createdAt: req.createdAt.toISOString(),
                    updatedAt: req.updatedAt.toISOString(),
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
                    status: inv.status,
                    createdAt: inv.createdAt.toISOString(),
                }
            });
        });

        // Map Notifications
        notifications.forEach((n: any) => {
            items.push({
                type: "NOTIFICATION",
                data: {
                    id: n.id,
                    userId: n.userId,
                    orgId: n.orgId,
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
