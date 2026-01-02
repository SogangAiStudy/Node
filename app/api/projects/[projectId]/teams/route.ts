import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";

export const dynamic = "force-dynamic";

interface RouteContext {
    params: Promise<{ projectId: string }>;
}

export async function GET(
    req: NextRequest,
    context: RouteContext
) {
    try {
        const session = await requireAuth();
        const { projectId } = await context.params;

        // Get project with its teams
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                projectTeams: {
                    include: {
                        team: true,
                    },
                },
            },
        });

        if (!project) {
            return NextResponse.json(
                { error: "Project not found" },
                { status: 404 }
            );
        }

        // Extract teams from project teams
        const teams = project.projectTeams.map((pt) => ({
            id: pt.team.id,
            name: pt.team.name,
            orgId: pt.team.orgId,
            createdAt: pt.team.createdAt,
        }));

        return NextResponse.json({ teams });
    } catch (error) {
        console.error("Error fetching project teams:", error);
        return NextResponse.json(
            { error: "Failed to fetch project teams" },
            { status: 500 }
        );
    }
}
