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
