# Project

## High-level goal
- Inspect the current codebase, identify unnecessary files, and prepare a clean restart path based on the existing implementation.

## Architecture / structure
- Repository root is now the canonical `Node` git repository checkout on `main`.
- The root repo has the local Vercel link file at `.vercel/project.json` for the existing `node` Vercel project.
- The current remote-main tree uses `proxy.ts` at the repo root for request interception and still keeps a legacy `lib/node-status.ts` alongside the newer `lib/status/` helpers.
- Product documentation currently lives partly under `docs/` and partly in root markdown files such as `architecture.md` and `CREATE_REQUEST_BUGS.md`.
- Root `AGENTS.md` is the contributor guide for repository structure, commands, conventions, PR expectations, and Codex state handling.
- Product readiness smoke checks live in `scripts/smoke-product-readiness.mjs` and run through `npm run verify:smoke`; `npm run verify` chains lint, smoke checks, and production build.
- Playwright browser tests live under `tests/e2e/` and run with `npm run test:e2e`; DB-backed authenticated and collaboration-permission suites are gated behind `RUN_DB_E2E=1` and can run against the freshly pulled Vercel env with `npm run test:e2e:db:remote`.
- Archived sibling repositories and stale worktree snapshots now live outside the repo in `/Users/xavi/Desktop/real_code/Node_archive/`.
- The graph detail experience currently uses `components/graph/NodeDetailSheet.tsx`.
- Task collaboration now uses `NodePage`, `NodeComment`, and `NodeAttachment` Prisma models with node-scoped APIs under `app/api/nodes/[nodeId]/`.
- `components/graph/NodeDetailSheet.tsx` is now the primary task workspace surface, with details, page, comments, files, and activity views.
- Task file uploads are stored outside markdown through Supabase Storage using the `node-attachments` bucket by default.
- Nodes can now form a hierarchy through `nodes.parent_node_id`; the graph UI renders parent nodes as container blocks and supports Scratch-like drag-in/drag-out nesting.
- Graph node and edge creation uses optimistic UI updates first, then reconciles with the server; pending saves install browser/internal-link leave warnings.
- Workspace admin/member management now lives canonically at `app/(dashboard)/org/[orgId]/settings/page.tsx`; the older `app/(dashboard)/organization/members/page.tsx` route is legacy.
- Team-targeted requests now use stable `requests.targetTeamId` IDs with `toTeam` kept only as a backward-compatible display alias.
- Default team identity is now a schema flag (`teams.isDefault`) instead of the literal name `"Default Team"`.

## Key decisions
- Persistent project state is tracked in `.codex/project.md`, `.codex/tasks.md`, and `.codex/log.md`.
- This project should not rely on chat history for state; each step must re-read and then update the `.codex` files.
- Concurrent Codex sessions must not share a single `.codex` state directory unless they are strictly serialized; this workspace is now consolidated back to the root checkout plus the separate `/private/tmp/node-auth-fix` git worktree.
- Cleanup should avoid deleting source repositories until their roles are confirmed.
- Only regenerable artifacts and obvious temp files were removed during initial cleanup.
- The repository root is the canonical working directory for local app development and restart work.
- The app should no longer auto-provision users into a seeded demo org or create dummy team members by default; old demo data is now cleaned up explicitly when needed.
- Member-role naming should be split by scope: workspace/org uses `Admin` and `Member`; project access uses `Admin`, `Editor`, and `Viewer`, with `Guest` reserved as a later optional role.
- Vercel deployments must rely on Vercel-managed environment variables and request-host detection, not uploaded local `.env*` files.
- Prisma runtime should normalize Supabase transaction-pooler URLs by adding `pgbouncer=true` and `connection_limit=1` when those query params are missing from `DATABASE_URL`.
- The root dashboard route should resolve the user's workspace redirect on the server instead of rendering a client-side loading screen that depends on `/api/workspaces`.
- The dashboard segment must render dynamically because auth/session access uses request headers; forcing static rendering on `/` causes `DYNAMIC_SERVER_USAGE`.
- The canonical GitHub remote for this workspace is now the personal `SeobinChoi/Node` repository instead of the old `SogangAiStudy/Node` org remote.
- Admin navigation for workspace members/teams should route to the canonical org-scoped settings page, not the legacy `/organization/members` route.
- Workspace invite links should immediately create an `ACTIVE` org membership and ensure the joined user is assigned to the workspace's default team.
- Project visibility is no longer org-wide by default; non-admin users only access projects they own, join directly, or receive via assigned teams.
- Collaboration/permission e2e now verifies admin, editor-team, viewer-team, direct invitee, blocked org member, deactivated org member, and external-user access boundaries against task page, comments, attachments, project teams, project invites, node creation, and graph APIs.
- Workspace member removal supports both soft deactivation (`DEACTIVATED`) and hard workspace removal via `DELETE /api/organizations/members/[userId]`.
- Task page bodies are stored as Markdown in `node_pages.content_markdown`; legacy `nodes.description` is only used as initial backfill content.
- Task attachments require server-side Supabase Storage env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and optional `SUPABASE_STORAGE_BUCKET`.
- Supabase project `ihmzppnyhcbrsviuficr` now has the task-collaboration DB migrations applied and the private `node-attachments` Storage bucket created.
- ESLint currently treats legacy `any`, unescaped text, and React compiler debt as warnings so `npm run lint` remains a passing gate. Warning count is now 0 after targeted type cleanup and unused-code removal.
- Playwright uses bundled Chromium installed under `/Users/xavi/Library/Caches/ms-playwright/`; the global Codex Playwright MCP config was updated to point at that executable, but already-running Codex sessions may need restart before MCP browser tools reload the new setting.
- Playwright webServer uses `next dev --webpack` because the Turbopack dev server can hang while compiling `/api/projects/[projectId]/invites`; production builds still use the default Next.js production build path.
- New graph connections default to `DEPENDS_ON` without a creation-time relation picker; existing relation types are changed by clicking an existing edge and editing it.
