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

        // Get project to verify organization
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { orgId: true },
        });

        if (!project) {
            return NextResponse.json(
                { error: "Project not found" },
                { status: 404 }
            );
        }

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

        // Verify user is member of the organization
        const orgMember = await prisma.orgMember.findUnique({
            where: {
                orgId_userId: {
                    orgId: project.orgId,
                    userId: user.id,
                },
            },
        });

        if (!orgMember) {
            return NextResponse.json(
                { error: "User is not a member of this organization" },
                { status: 403 }
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
