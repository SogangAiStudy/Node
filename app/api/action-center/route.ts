import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/utils/auth";
import { prisma } from "@/lib/db/prisma";
import { computeAllNodeStatuses } from "@/lib/status/compute-status";
import {
    getMyActionsForActionCenter,
    getMyWaitingForActionCenter,
    getImBlockingForActionCenter
} from "@/lib/status/status-filters";

export async function GET(req: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Default to first org found if not specified? Or require it?
        // Sidebar usually navigates with orgId.
        // We can grab it from query param to be safe if this is called from client.
        const url = new URL(req.url);
        const orgId = url.searchParams.get("orgId");

        if (!orgId) {
            return NextResponse.json({ error: "Org ID required" }, { status: 400 });
        }

        // 1. Fetch all nodes, edges, requests for the organization
        const [nodes, edges, requests] = await Promise.all([
            prisma.node.findMany({
                where: { orgId },
                include: {
                    nodeOwners: { include: { user: true } },
                    owner: true,
                    project: { select: { id: true, name: true } },
                    team: { select: { id: true, name: true } },
                }
            }),
            prisma.edge.findMany({
                where: { orgId }
            }),
            prisma.request.findMany({
                where: { orgId },
                include: { toUser: true }
            })
        ]);

        // 2. Compute statuses for EVERYTHING in the org
        const statusMap = computeAllNodeStatuses(nodes, edges, requests);

        // 3. Filter for the user using strict Action Center filters
        const myActionsNodes = getMyActionsForActionCenter(user.id, nodes, statusMap);
        const myWaitingNodes = getMyWaitingForActionCenter(user.id, nodes, statusMap);
        const imBlockingData = getImBlockingForActionCenter(user.id, nodes, edges);

        // 4. Transform to DTOs
        type NodeWithRelations = typeof nodes[number];

        const mapNodeToDTO = (n: NodeWithRelations): any => ({
            id: n.id,
            title: n.title,
            projectId: n.projectId,
            projectName: n.project?.name,
            manualStatus: n.manualStatus,
            computedStatus: statusMap.get(n.id),
            dueAt: n.dueAt,
            ownerId: n.ownerId,
            ownerName: n.owner?.name,
            orgId: n.orgId,
            teams: [],
            owners: n.nodeOwners.map(no => ({ id: no.userId, name: no.user.name })),
            createdAt: n.createdAt.toISOString(),
            updatedAt: n.updatedAt.toISOString(),
            type: n.type,
            priority: n.priority
        });

        const myActions = myActionsNodes.map((n: any) => mapNodeToDTO(n));

        const enrichWaitingNode = (n: any) => {
            const status = statusMap.get(n.id);
            let reason = "Unknown";
            let responsible: string[] = [];

            // Check requests
            const activeRequests = requests.filter(r => r.linkedNodeId === n.id && (r.status === 'OPEN' || r.status === 'RESPONDED'));

            // Check edges for BLOCKED
            if (status === 'BLOCKED') {
                const blockingEdges = edges.filter(e => e.fromNodeId === n.id && e.relation === 'DEPENDS_ON');
                const blockingNodes = nodes.filter(node => blockingEdges.some(e => e.toNodeId === node.id));

                reason = `Blocked by ${blockingNodes.length} task${blockingNodes.length > 1 ? 's' : ''} `;
                responsible = blockingNodes.flatMap(bn => {
                    if (bn.owner?.name) return [bn.owner.name];
                    if (bn.nodeOwners?.length) return bn.nodeOwners.map((no: any) => no.user.name || "Unknown");
                    return [];
                }).filter((name): name is string => !!name);
            }
            else if (status === 'WAITING') {
                if (activeRequests.length > 0) {
                    reason = "Waiting for response";
                    responsible = activeRequests.map(r => r.toUser?.name || r.toTeam || "Unassigned").filter((name): name is string => !!name);
                } else {
                    const approvalEdges = edges.filter(e => e.fromNodeId === n.id && e.relation === 'APPROVAL_BY');
                    if (approvalEdges.length > 0) {
                        reason = "Waiting for approval";
                        const approvalNodes = nodes.filter(node => approvalEdges.some(e => e.toNodeId === node.id));
                        responsible = approvalNodes.flatMap(bn => {
                            if (bn.owner?.name) return [bn.owner.name];
                            if (bn.nodeOwners?.length) return bn.nodeOwners.map((no: any) => no.user.name || "Unknown");
                            return [];
                        }).filter((name): name is string => !!name);
                    }
                }
            }

            return {
                ...mapNodeToDTO(n),
                reason,
                responsible: Array.from(new Set(responsible)),
                waitingSince: n.updatedAt
            };
        };

        const waiting = myWaitingNodes.map((n: any) => enrichWaitingNode(n));

        // Blocking
        const blockingMap = new Map();
        imBlockingData.forEach(({ waitingOnMyNode, blockedNode }) => {
            if (!blockingMap.has(waitingOnMyNode.id)) {
                blockingMap.set(waitingOnMyNode.id, {
                    node: waitingOnMyNode,
                    blockedCount: 0,
                    affectedProjects: new Set()
                });
            }
            const entry = blockingMap.get(waitingOnMyNode.id);
            entry.blockedCount++;

            const bn = nodes.find(n => n.id === blockedNode.id);
            if (bn && bn.project) entry.affectedProjects.add(bn.project.name);
        });

        const blockingFinal = Array.from(blockingMap.values()).map(entry => ({
            ...mapNodeToDTO(entry.node),
            blockedCount: entry.blockedCount,
            affectedProjects: Array.from(entry.affectedProjects)
        }));

        return NextResponse.json({
            myActions,
            waiting,
            blocking: blockingFinal
        });

    } catch (error) {
        console.error("GET /api/action-center error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
