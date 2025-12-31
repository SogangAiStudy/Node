import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/utils/auth";

/**
 * GET /api/organizations/search?q=...
 * Search for organizations by name for onboarding
 */
export async function GET(request: NextRequest) {
    try {
        await requireAuth();
        const { searchParams } = new URL(request.url);
        const query = searchParams.get("q");

        if (!query || query.length < 2) {
            return NextResponse.json({ organizations: [] });
        }

        const organizations = await prisma.organization.findMany({
            where: {
                name: {
                    contains: query,
                    mode: "insensitive",
                },
            },
            select: {
                id: true,
                name: true,
            },
            take: 10,
        });

        return NextResponse.json({ organizations });
    } catch (error) {
        console.error("GET /api/organizations/search error:", error);
        return NextResponse.json(
            { error: "Failed to search organizations" },
            { status: 500 }
        );
    }
}
