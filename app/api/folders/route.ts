import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isOrgMember } from "@/lib/utils/auth";
import { z } from "zod";

const CreateFolderSchema = z.object({
    orgId: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
    parentId: z.string().optional(),
});

// GET /api/folders - Get all folders for an organization
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

        const folders = await prisma.folder.findMany({
            where: { orgId },
            orderBy: [
                { sortOrder: "asc" },
                { name: "asc" },
            ],
            include: {
                _count: {
                    select: { projects: true }
                }
            }
        });

        return NextResponse.json({ folders });
    } catch (error) {
        console.error("GET /api/folders error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// POST /api/folders - Create a new folder
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth();
        const body = await request.json();
        console.log(`[DEBUG] POST /api/folders - User: ${user.id}, Body:`, JSON.stringify(body));
        const validated = CreateFolderSchema.parse(body);

        if (!(await isOrgMember(validated.orgId, user.id))) {
            console.error("POST /api/folders error: User is not member of org", validated.orgId);
            return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
        }

        const folder = await prisma.folder.create({
            data: {
                orgId: validated.orgId,
                name: validated.name,
                description: validated.description,
                color: validated.color || "#3b82f6",
                parentId: validated.parentId,
            },
        });

        return NextResponse.json({ folder }, { status: 201 });
    } catch (error: any) {
        console.error("POST /api/folders error:", error);

        if (error.code === 'P2002') {
            return NextResponse.json({ error: "A folder with this name already exists in this location" }, { status: 409 });
        }

        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
        }
        return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
    }
}
