import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

function pathFor(relativePath) {
  return join(root, relativePath);
}

function read(relativePath) {
  return readFileSync(pathFor(relativePath), "utf8");
}

function check(label, condition) {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    failures.push(label);
    console.error(`FAIL ${label}`);
  }
}

function exists(relativePath) {
  return existsSync(pathFor(relativePath));
}

function includes(relativePath, text) {
  return read(relativePath).includes(text);
}

check("task page schema model exists", includes("prisma/schema.prisma", "model NodePage"));
check("task comment schema model exists", includes("prisma/schema.prisma", "model NodeComment"));
check("task attachment schema model exists", includes("prisma/schema.prisma", "model NodeAttachment"));
check("task collaboration migration exists", exists("prisma/migrations/20260428153000_node_task_collaboration/migration.sql"));
check("team membership migration exists", exists("prisma/migrations/20260406123000_teamspace_membership_overhaul/migration.sql"));
check("node hierarchy migration exists", exists("prisma/migrations/20260430103000_node_hierarchy/migration.sql"));
check("node hierarchy schema field exists", includes("prisma/schema.prisma", "parentNodeId"));

check("node page API exists", exists("app/api/nodes/[nodeId]/page/route.ts"));
check("node comments API exists", exists("app/api/nodes/[nodeId]/comments/route.ts"));
check("node attachments API exists", exists("app/api/nodes/[nodeId]/attachments/route.ts"));
check("attachment upload validates file type and size", includes("app/api/nodes/[nodeId]/attachments/route.ts", "assertAllowedAttachment"));
check("node page editing requires project edit access", includes("app/api/nodes/[nodeId]/page/route.ts", "requireProjectEdit"));
check("node page viewing requires project view access", includes("app/api/nodes/[nodeId]/page/route.ts", "requireProjectView"));
check("mentions are resolved for task page edits", includes("app/api/nodes/[nodeId]/page/route.ts", "resolveMentionedProjectUsers"));
check("mentions are resolved for comments", includes("app/api/nodes/[nodeId]/comments/route.ts", "resolveMentionedProjectUsers"));

check("task workspace UI has page tab", includes("components/graph/NodeDetailSheet.tsx", "Page"));
check("task workspace UI has comments tab", includes("components/graph/NodeDetailSheet.tsx", "Comments"));
check("task workspace UI has files tab", includes("components/graph/NodeDetailSheet.tsx", 'value="files"'));
check("task workspace UI has activity tab", includes("components/graph/NodeDetailSheet.tsx", "Activity"));
check("graph supports parented child nodes", includes("components/graph/GraphCanvas.tsx", "parentNode"));
check("graph supports dragging nodes into containers", includes("components/graph/GraphCanvas.tsx", "Moved inside"));

check("Supabase URL env documented", includes(".env.example", "SUPABASE_URL"));
check("Supabase service role env documented", includes(".env.example", "SUPABASE_SERVICE_ROLE_KEY"));
check("Supabase storage bucket env documented", includes(".env.example", "SUPABASE_STORAGE_BUCKET"));
check("storage helper uses signed download URLs", includes("lib/utils/node-collaboration.ts", "/storage/v1/object/sign/"));

check("project sharing uses current invites endpoint", includes("components/project/ShareModal.tsx", "/api/projects/${projectId}/invites"));
check("project roles use editor/viewer/admin scope", includes("components/project/ShareModal.tsx", "PROJECT_ADMIN"));
check("test make-user API is removed", !exists("app/api/test/make-user/route.ts"));
check("mock workspace data is removed", !exists("lib/mock-workspace-data.ts"));

check("team-target notification read path exists", includes("app/api/notifications/[id]/read/route.ts", "targetTeamId"));
check("unified inbox exposes notification project navigation", includes("app/api/inbox/unified/route.ts", "projectId"));
check("workspace project listing uses real workspace structure", includes("app/(dashboard)/org/[orgId]/projects/page.tsx", "useWorkspaceStructure"));

if (failures.length > 0) {
  console.error(`\nSmoke verification failed: ${failures.length} check(s) failed.`);
  process.exit(1);
}

console.log("\nSmoke verification passed.");
