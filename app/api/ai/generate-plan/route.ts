import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";
import { requireProjectView } from "@/lib/utils/permissions";
import { isOrgPro } from "@/lib/subscription";
import { getOpenAIClient, checkRateLimit } from "@/lib/ai/openai";
import { z } from "zod";

const GeneratePlanSchema = z.object({
    projectId: z.string(),
    text: z.string().min(1).max(10000),
    feedback: z.string().optional(), // For regeneration with feedback
});

export interface GeneratedPlanNode {
    tempId: string;
    title: string;
    description: string;
    type: "TASK" | "DECISION" | "BLOCKER" | "INFOREQ";
    suggestedTeamIds: string[];
    phase?: string;
}

export interface GeneratedPlanEdge {
    fromTempId: string;
    toTempId: string;
    relation: "DEPENDS_ON" | "APPROVAL_BY" | "NEEDS_INFO_FROM" | "HANDOFF_TO";
}

export interface GeneratedPlan {
    inputType: "keyword" | "outline" | "meeting_notes";
    nodes: GeneratedPlanNode[];
    edges: GeneratedPlanEdge[];
    summary: string;
}

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await req.json();
        const { projectId, text, feedback } = GeneratePlanSchema.parse(body);

        // Get project and teams
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: {
                id: true,
                orgId: true,
                name: true,
                projectTeams: {
                    include: {
                        team: {
                            select: { id: true, name: true, description: true },
                        },
                    },
                },
            },
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        // Permission Check
        await requireProjectView(projectId, user.id);

        // Subscription & Limit Check
        const isPro = await isOrgPro(project.orgId);

        // Count generations in the last 24h for this user
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const dailyUsageCount = await prisma.activityLog.count({
            where: {
                userId: user.id,
                action: "GENERATE_PLAN",
                createdAt: { gte: twentyFourHoursAgo },
            },
        });

        if (!isPro && dailyUsageCount >= 99) {
            return NextResponse.json(
                { error: "Free plan is limited to 99 AI generations per day. Upgrade to Pro for unlimited access." },
                { status: 403 }
            );
        }

        // Rate Limit Check (Short term bursts)
        if (!checkRateLimit(user.id)) {
            return NextResponse.json(
                { error: "Rate limit exceeded. Please try again in a minute." },
                { status: 429 }
            );
        }

        // Build team context for LLM
        const teamContext = project.projectTeams.map((pt) => ({
            id: pt.team.id,
            name: pt.team.name,
            description: pt.team.description || "",
        }));

        const teamListStr =
            teamContext.length > 0
                ? teamContext.map((t) => `- ${t.name} (ID: ${t.id}): ${t.description}`).join("\n")
                : "No teams assigned to this project.";

        // Call OpenAI
        const openai = getOpenAIClient();
        const systemPrompt = `You are a project planning assistant. Your task is to analyze user input and create a structured implementation plan as a series of connected nodes.

INPUT TYPES:
1. "keyword": Short words or ideas (e.g., "Mobile app launch", "Website renewal")
   - Generate a comprehensive step-by-step plan to achieve the goal
   - Create logical phases (Planning, Design, Development, Testing, Deployment, etc.)
   
2. "outline": Brief topic outlines or bullet points
   - Expand each point into actionable tasks
   - Add missing steps and dependencies
   
3. "meeting_notes": Meeting transcripts or notes
   - Extract action items and tasks from the discussion
   - Preserve the original intent and assignees mentioned
   - Create dependencies based on mentioned blockers or sequences

PROJECT TEAMS:
${teamListStr}

RESPONSE FORMAT (JSON):
{
  "inputType": "keyword" | "outline" | "meeting_notes",
  "summary": "Brief summary of the generated plan in English",
  "nodes": [
    {
      "tempId": "temp_1",
      "title": "Task title (max 50 chars)",
      "description": "Brief description",
      "type": "TASK" | "DECISION" | "BLOCKER" | "INFOREQ",
      "suggestedTeamIds": ["team_id_1"],
      "phase": "Optional phase name like 'Phase 1: Planning'"
    }
  ],
  "edges": [
    {
      "fromTempId": "temp_1",
      "toTempId": "temp_2", 
      "relation": "DEPENDS_ON" | "HANDOFF_TO" | "NEEDS_INFO_FROM" | "APPROVAL_BY"
    }
  ]
}

RULES:
- Use tempId format: "temp_1", "temp_2", etc.
- DEPENDS_ON: temp_2 cannot start until temp_1 is done
- HANDOFF_TO: Work flows from temp_1 to temp_2
- Assign teams based on task type and team descriptions
- If no suitable team, leave suggestedTeamIds empty
- Create 5-15 nodes for keywords, follow content closely for meeting notes
- Write all content in English`;

        const userPrompt = feedback
            ? `Previous input: ${text}\n\nUser feedback for regeneration:\n${feedback}`
            : `Create a plan from this input:\n\n${text}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
            max_tokens: 4000,
        });

        const responseText = completion.choices[0]?.message?.content || "{}";
        let result: GeneratedPlan;

        try {
            result = JSON.parse(responseText);
            // Validate structure
            if (!Array.isArray(result.nodes)) {
                result = {
                    inputType: "keyword",
                    nodes: [],
                    edges: [],
                    summary: "Failed to generate plan",
                };
            }
            if (!Array.isArray(result.edges)) {
                result.edges = [];
            }
            if (!result.summary) {
                result.summary = "";
            }
            if (!result.inputType) {
                result.inputType = "keyword";
            }
        } catch {
            result = {
                inputType: "keyword",
                nodes: [],
                edges: [],
                summary: "Failed to parse response",
            };
        }

        // Log the successful generation
        await prisma.activityLog.create({
            data: {
                projectId,
                orgId: project.orgId,
                userId: user.id,
                action: "GENERATE_PLAN",
                entityType: "PROJECT",
                entityId: projectId,
                details: { inputType: result.inputType, nodeCount: result.nodes.length },
            },
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("Plan Generation Error:", error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        return NextResponse.json({ error: "Failed to generate plan" }, { status: 500 });
    }
}
