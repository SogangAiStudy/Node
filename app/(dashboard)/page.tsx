import { getCurrentUserWorkspaces } from "@/lib/workspaces";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let workspaces: Awaited<ReturnType<typeof getCurrentUserWorkspaces>>;

  try {
    workspaces = await getCurrentUserWorkspaces();
  } catch (error) {
    console.error("Dashboard bootstrap failed:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h2 className="text-lg font-semibold text-red-600 mb-2">Failed to load workspaces</h2>
          <p className="text-muted-foreground mb-4">There was an error connecting to the server.</p>
          <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
            Try refreshing the page
          </Link>
        </div>
      </div>
    );
  }

  const activeWorkspace = workspaces.find((workspace) =>
    ["ACTIVE", "PENDING_TEAM_ASSIGNMENT"].includes(workspace.status)
  );

  if (activeWorkspace?.orgId) {
    redirect(`/org/${activeWorkspace.orgId}/projects`);
  }

  const firstWorkspace = workspaces[0];
  if (firstWorkspace?.orgId) {
    redirect(`/org/${firstWorkspace.orgId}/projects`);
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">No workspaces yet</h2>
        <p className="mt-2 text-sm text-slate-600">
          Create a workspace or join one with an invite code to get started.
        </p>
      </div>
    </div>
  );
}
