import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireProjectEdit } from "@/lib/utils/permissions";
import { z } from "zod";

const BatchPositionsSchema = z.object({
    positions: z.array(
        z.object({
            nodeId: z.string(),
            x: z.number(),
            y: z.number(),
        })
    ),
});

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const user = await requireAuth();
        const { projectId } = await params;
        const body = await req.json();
        const { positions } = BatchPositionsSchema.parse(body);

        // Permission check
        await requireProjectEdit(projectId, user.id);

        // Verify project exists
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true },
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        // Update all positions in a transaction
        await prisma.$transaction(
            positions.map((pos) =>
                prisma.node.update({
                    where: { id: pos.nodeId },
                    data: {
                        positionX: pos.x,
                        positionY: pos.y,
                    },
                })
            )
        );

        return NextResponse.json({
            success: true,
            updated: positions.length,
        });
    } catch (error) {
        console.error("Batch positions error:", error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        return NextResponse.json(
            { error: "Failed to update positions" },
            { status: 500 }
        );
    }
}
