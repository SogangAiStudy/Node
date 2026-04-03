import { NextResponse } from "next/server";
import { getCurrentUserWorkspaces } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

// GET /api/workspaces - Get all user's workspaces with unread inbox indicator
export async function GET() {
  try {
    const workspaces = await getCurrentUserWorkspaces();
    return NextResponse.json(workspaces);
  } catch (error) {
    console.error("GET /api/workspaces error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch workspaces";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
