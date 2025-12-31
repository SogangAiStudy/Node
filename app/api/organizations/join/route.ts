import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { z } from "zod";

const joinOrgSchema = z.object({
    orgId: z.string().min(1, "Organization ID is required"),
});

/**
 * POST /api/organizations/join
 * Submit a request to join an organization
 */
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await request.json();
        const { orgId } = joinOrgSchema.parse(body);

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

        // Create a membership with PENDING_APPROVAL status
        const orgMember = await prisma.orgMember.create({
            data: {
                orgId,
                userId: user.id,
                role: "MEMBER",
                status: "PENDING_APPROVAL",
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
