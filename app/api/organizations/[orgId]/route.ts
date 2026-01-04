import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { z } from "zod";

const updateOrgSchema = z.object({
    name: z.string().min(1).max(100).optional(),
});

/**
 * GET /api/organizations/[orgId]
 * Fetch organization details
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const user = await requireAuth();
        const { orgId } = await params;

        const orgMember = await prisma.orgMember.findUnique({
            where: {
                orgId_userId: {
                    orgId,
                    userId: user.id,
                },
            },
            include: {
                organization: true,
            },
        });

        if (!orgMember) {
            return NextResponse.json({ error: "Access denied or workspace not found" }, { status: 403 });
        }

        // Auto-generate inviteCode if missing (for existing workspaces created before this feature)
        let inviteCode = orgMember.organization.inviteCode;
        if (!inviteCode) {
            inviteCode = crypto.randomUUID();
            await prisma.organization.update({
                where: { id: orgId },
                data: { inviteCode },
            });
        }

        return NextResponse.json({
            organization: {
                id: orgMember.organization.id,
                name: orgMember.organization.name,
                inviteCode,
                role: orgMember.role,
                status: orgMember.status,
                createdAt: orgMember.organization.createdAt,
            }
        });
    } catch (error) {
        console.error("GET /api/organizations/[orgId] error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * PATCH /api/organizations/[orgId]
 * Update organization details
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const user = await requireAuth();
        const { orgId } = await params;
        const body = await request.json();
        const { name } = updateOrgSchema.parse(body);

        const orgMember = await prisma.orgMember.findUnique({
            where: {
                orgId_userId: {
                    orgId,
                    userId: user.id,
                },
            },
        });

        if (!orgMember || orgMember.role !== "ADMIN") {
            return NextResponse.json({ error: "Only admins can update workspace settings" }, { status: 403 });
        }

        const updatedOrg = await prisma.organization.update({
            where: { id: orgId },
            data: {
                ...(name && { name }),
            },
        });

        return NextResponse.json({
            organization: {
                id: updatedOrg.id,
                name: updatedOrg.name,
            }
        });
    } catch (error) {
        console.error("PATCH /api/organizations/[orgId] error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * DELETE /api/organizations/[orgId]
 * Delete organization and all related data (cascade)
 * Requires admin role and workspace name confirmation
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const user = await requireAuth();
        const { orgId } = await params;
        const body = await request.json();
        const { confirmName } = body;

        // Verify user is admin of this org
        const orgMember = await prisma.orgMember.findUnique({
            where: {
                orgId_userId: {
                    orgId,
                    userId: user.id,
                },
            },
            include: {
                organization: true,
            },
        });

        if (!orgMember || orgMember.role !== "ADMIN") {
            return NextResponse.json({ error: "Only admins can delete workspace" }, { status: 403 });
        }

        // Confirm name matches
        if (confirmName !== orgMember.organization.name) {
            return NextResponse.json({ error: "Workspace name does not match" }, { status: 400 });
        }

        // Cascade delete all related data using a transaction
        await prisma.$transaction(async (tx) => {
            // Get all projects in this org
            const projects = await tx.project.findMany({
                where: { orgId },
                select: { id: true },
            });
            const projectIds = projects.map(p => p.id);

            // Delete in order to satisfy foreign key constraints
            // 1. Activity logs
            await tx.activityLog.deleteMany({ where: { orgId } });

            // 2. Requests
            await tx.request.deleteMany({ where: { orgId } });

            // 3. Node relationships
            await tx.nodeOwner.deleteMany({ where: { node: { orgId } } });
            await tx.nodeTeam.deleteMany({ where: { node: { orgId } } });

            // 4. Edges
            await tx.edge.deleteMany({ where: { orgId } });

            // 5. Nodes
            await tx.node.deleteMany({ where: { orgId } });

            // 6. Project members and teams
            await tx.projectMember.deleteMany({ where: { projectId: { in: projectIds } } });
            await tx.projectTeam.deleteMany({ where: { projectId: { in: projectIds } } });

            // 7. Projects
            await tx.project.deleteMany({ where: { orgId } });

            // 8. Folders (if table exists)
            try {
                await tx.$executeRaw`DELETE FROM "public"."folders" WHERE "orgId" = ${orgId}`;
            } catch (e) {
                // Folder table might not exist, skip
            }

            // 9. Team members
            await tx.teamMember.deleteMany({ where: { orgId } });

            // 10. Teams
            await tx.team.deleteMany({ where: { orgId } });

            // 11. Org inbox states
            await tx.orgInboxState.deleteMany({ where: { orgId } });

            // 12. Org members
            await tx.orgMember.deleteMany({ where: { orgId } });

            // 13. Finally, delete the organization
            await tx.organization.delete({ where: { id: orgId } });
        });

        return NextResponse.json({ success: true, message: "Workspace deleted successfully" });
    } catch (error) {
        console.error("DELETE /api/organizations/[orgId] error:", error);
        return NextResponse.json({ error: "Failed to delete workspace" }, { status: 500 });
    }
}
