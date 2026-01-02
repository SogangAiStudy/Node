import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

interface RouteContext {
    params: Promise<{ projectId: string }>;
}

const InviteSchema = z.object({
    email: z.string().email(),
    role: z.enum(["ADMIN", "EDITOR", "REQUESTER", "VIEWER"]),
});

export async function POST(
    req: NextRequest,
    context: RouteContext
) {
    try {
        const session = await requireAuth();
        const { projectId } = await context.params;
        const body = await req.json();

        const { email, role } = InviteSchema.parse(body);

        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return NextResponse.json(
                { error: "User not found. They need to sign up first." },
                { status: 404 }
            );
        }

        // Check if already a member
        const existing = await prisma.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId: user.id,
                },
            },
        });

        if (existing) {
            return NextResponse.json(
                { error: "User is already a member of this project" },
                { status: 400 }
            );
        }

        // Add as project member
        const member = await prisma.projectMember.create({
            data: {
                projectId,
                userId: user.id,
                team: role, // Using team field to store role
            },
        });

        return NextResponse.json({ member });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Invalid request data" },
                { status: 400 }
            );
        }

        console.error("Error inviting user:", error);
        return NextResponse.json(
            { error: "Failed to invite user" },
            { status: 500 }
        );
    }
}
