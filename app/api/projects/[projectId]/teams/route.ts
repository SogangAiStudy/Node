import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { isProjectAdmin, requireProjectView } from "@/lib/utils/permissions";
import { authOrPermissionErrorResponse } from "@/lib/utils/api-error-responses";
import { triggerProjectAssignmentNotifications } from "@/lib/utils/notifications";
import { z } from "zod";

const AddTeamSchema = z.object({
    teamId: z.string(),
    role: z.enum(["PROJECT_ADMIN", "EDITOR", "VIEWER"]).default("EDITOR"),
});

// GET /api/projects/[projectId]/teams
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const user = await requireAuth();
        const { projectId } = await params;

        await requireProjectView(projectId, user.id);

        const projectTeams = await prisma.projectTeam.findMany({
            where: {
                projectId: projectId,
            },
            include: {
                team: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: {
                team: {
                    name: "asc",
                },
            },
        });

        return NextResponse.json(projectTeams);
    } catch (error) {
        const authResponse = authOrPermissionErrorResponse(error);
        if (authResponse) return authResponse;
        console.error("GET Project Teams error:", error);
        return NextResponse.json({ error: "Failed to fetch project teams" }, { status: 500 });
    }
}

// POST /api/projects/[projectId]/teams
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const user = await requireAuth();
        const { projectId } = await params;
        const body = await request.json();
        const validated = AddTeamSchema.parse(body);

        const project = await prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

        // Check permissions
        const isAdmin = await isProjectAdmin(projectId, user.id);
        if (!isAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        // Verify team belongs to Org
        const team = await prisma.team.findUnique({
            where: { id: validated.teamId },
        });

        if (!team || team.orgId !== project.orgId) {
            return NextResponse.json({ error: "Invalid team" }, { status: 400 });
        }

        // Check if team already added
        const existing = await prisma.projectTeam.findUnique({
            where: {
                projectId_teamId: {
                    projectId,
                    teamId: validated.teamId,
                },
            },
        });

        if (existing) {
            return NextResponse.json({ error: "Team already added" }, { status: 409 });
        }

        // Add Team
        const projectTeam = await prisma.projectTeam.create({
            data: {
                orgId: project.orgId,
                projectId,
                teamId: validated.teamId,
                role: validated.role,
            },
        });

        // Trigger project assignment notification
        await triggerProjectAssignmentNotifications({
            projectId,
            projectName: project.name,
            orgId: project.orgId,
            teamIds: [validated.teamId],
        });

        return NextResponse.json(projectTeam);
    } catch (error) {
        console.error("POST Add Team error:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }
        return NextResponse.json({ error: "Failed to add team" }, { status: 500 });
    }
}
