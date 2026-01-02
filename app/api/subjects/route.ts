import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isOrgMember } from "@/lib/utils/auth";
import { z } from "zod";

const CreateSubjectSchema = z.object({
    orgId: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
});

// GET /api/subjects - Get all subjects for an organization
export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth();
        const { searchParams } = new URL(request.url);
        const orgId = searchParams.get("orgId");

        if (!orgId) {
            return NextResponse.json({ error: "orgId is required" }, { status: 400 });
        }

        if (!(await isOrgMember(orgId, user.id))) {
            return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
        }

        const subjects = await prisma.subject.findMany({
            where: { orgId },
            orderBy: [
                { sortOrder: "asc" },
                { name: "asc" },
            ],
        });

        return NextResponse.json({ subjects });
    } catch (error) {
        console.error("GET /api/subjects error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// POST /api/subjects - Create a new subject
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await request.json();
        console.log(`[DEBUG] POST /api/subjects - User: ${user.id}, Body:`, JSON.stringify(body));
        const validated = CreateSubjectSchema.parse(body);

        if (!(await isOrgMember(validated.orgId, user.id))) {
            console.error("POST /api/subjects error: User is not member of org", validated.orgId);
            return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
        }

        const subject = await prisma.subject.create({
            data: {
                orgId: validated.orgId,
                name: validated.name,
                description: validated.description,
                color: validated.color || "#3b82f6",
            },
        });

        return NextResponse.json({ subject }, { status: 201 });
    } catch (error: any) {
        console.error("POST /api/subjects error:", error);

        if (error.code === 'P2002') {
            return NextResponse.json({ error: "A subject with this name already exists in this organization" }, { status: 409 });
        }

        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
        }
        return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
    }
}
