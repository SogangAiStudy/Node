import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { z } from "zod";

const joinOrgSchema = z.object({
    orgId: z.string().optional(),
    inviteCode: z.string().optional(),
});

/**
 * POST /api/organizations/join
 * Submit a request to join an organization or join directly via invite code
 */
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await request.json();
        const { orgId: bodyOrgId, inviteCode } = joinOrgSchema.parse(body);

        let targetOrgId = bodyOrgId;
        let autoApprove = false;

        if (inviteCode) {
            const org = await prisma.organization.findUnique({
                where: { inviteCode },
                select: { id: true }
            });
            if (!org) {
                return NextResponse.json({ error: "Invalid invite code" }, { status: 400 });
            }
            targetOrgId = org.id;
            autoApprove = true;
        }

        if (!targetOrgId) {
            return NextResponse.json({ error: "Organization ID or invite code is required" }, { status: 400 });
        }

        const orgId = targetOrgId;

        // Check if user already has a membership in this org
        const existingMembership = await prisma.orgMember.findUnique({
            where: {
                orgId_userId: {
                    orgId,
                    userId: user.id,
                },
            },
        });

        if (existingMembership) {
            return NextResponse.json(
                { error: "You already have a membership or pending request in this organization" },
                { status: 400 }
            );
        }

        // Create a membership with appropriate status
        const orgMember = await prisma.orgMember.create({
            data: {
                orgId,
                userId: user.id,
                role: "MEMBER",
                status: autoApprove ? "PENDING_TEAM_ASSIGNMENT" : "PENDING_APPROVAL",
            },
        });

        return NextResponse.json({
            message: "Join request submitted successfully",
            membershipId: orgMember.id,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Invalid request data", details: error.flatten() },
                { status: 400 }
            );
        }

        console.error("POST /api/organizations/join error:", error);
        return NextResponse.json(
            { error: "Failed to submit join request" },
            { status: 500 }
        );
    }
}
