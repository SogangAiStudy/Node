import { NextResponse } from "next/server";

export function authOrPermissionErrorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }

  if (error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    error.message === "Not authorized to view this project" ||
    error.message === "Not authorized to edit this project" ||
    error.message === "Not a member of this project" ||
    error.message === "Not a member of this organization" ||
    error.message === "Organization admin access required" ||
    error.message.includes("access required")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
