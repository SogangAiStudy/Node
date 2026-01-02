import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

interface RouteContext {
    params: Promise<{ projectId: string; userId: string }>;
}

const UpdateRoleSchema = z.object({
    role: z.enum(["ADMIN", "EDITOR", "REQUESTER", "VIEWER"]),
});

export async function PATCH(
    req: NextRequest,
    context: RouteContext
) {
    try {
        const session = await requireAuth();
        const { projectId, userId } = await context.params;
        const body = await req.json();

        const { role } = UpdateRoleSchema.parse(body);

        // Update member role
        const updated = await prisma.projectMember.update({
            where: {
                projectId_userId: {
                    projectId,
                    userId,
                },
            },
            data: {
                team: role, // Using team field to store role
            },
        });

        return NextResponse.json({ member: updated });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Invalid request data" },
                { status: 400 }
            );
        }

        console.error("Error updating member role:", error);
        return NextResponse.json(
            { error: "Failed to update role" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    context: RouteContext
) {
    try {
        const session = await requireAuth();
        const { projectId, userId } = await context.params;

        // Remove member
        await prisma.projectMember.delete({
            where: {
                projectId_userId: {
                    projectId,
                    userId,
                },
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error removing member:", error);
        return NextResponse.json(
            { error: "Failed to remove member" },
            { status: 500 }
        );
    }
}
