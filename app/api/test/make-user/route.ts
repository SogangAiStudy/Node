import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";

export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth();

        // Get user's current organization
        const orgMember = await prisma.orgMember.findFirst({
            where: {
                userId: user.id,
            },
            select: {
                orgId: true,
            },
        });

        if (!orgMember) {
            return NextResponse.json({ error: "No organization found" }, { status: 404 });
        }

        const orgId = orgMember.orgId;

        // Create a random user
        const randomId = Math.floor(Math.random() * 10000);
        const newUser = await prisma.user.create({
            data: {
                email: `user${randomId}@example.com`,
                name: `Test User ${randomId}`,
            },
        });

        // Add to organization as ACTIVE MEMBER
        await prisma.orgMember.create({
            data: {
                orgId,
                userId: newUser.id,
                role: "MEMBER",
                status: "ACTIVE",
            },
        });

        return NextResponse.json({ success: true, user: newUser });
    } catch (error) {
        console.error("POST /api/test/make-user error:", error);
        return NextResponse.json(
            { error: "Failed to create mock user" },
            { status: 500 }
        );
    }
}
