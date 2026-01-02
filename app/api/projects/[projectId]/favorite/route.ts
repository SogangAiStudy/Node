import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

interface RouteContext {
    params: Promise<{ projectId: string }>;
}

export async function PATCH(
    req: NextRequest,
    context: RouteContext
) {
    try {
        const session = await requireAuth();
        const { projectId } = await context.params;

        // Check if user is a member of this project
        const member = await prisma.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId: session.id,
                },
            },
        });

        if (!member) {
            return NextResponse.json(
                { error: "Not a member of this project" },
                { status: 403 }
            );
        }

        // Toggle favorite status
        const updated = await prisma.projectMember.update({
            where: {
                projectId_userId: {
                    projectId,
                    userId: session.id,
                },
            },
            data: {
                isFavorite: !member.isFavorite,
            },
        });

        return NextResponse.json({ isFavorite: updated.isFavorite });
    } catch (error) {
        console.error("Error toggling favorite:", error);
        return NextResponse.json(
            { error: "Failed to toggle favorite" },
            { status: 500 }
        );
    }
}
