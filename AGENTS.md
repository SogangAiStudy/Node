# Repository Guidelines

## Project Structure & Module Organization
This is a Next.js App Router project. Routes, layouts, pages, and API handlers live in `app/`, including dashboard routes in `app/(dashboard)/` and REST-style handlers in `app/api/`. Shared React components are in `components/`: graph features in `components/graph/`, workspace UI in `components/workspace/`, project UI in `components/project/`, and reusable shadcn-style primitives in `components/ui/`. Business logic and integrations live in `lib/`; Prisma schema, migrations, and seed data live in `prisma/`. Static assets are in `public/`, scripts in `scripts/`, and shared types in `types/`.

## Build, Test, and Development Commands
- `npm run dev:local`: starts Next.js using `.env.local`.
- `npm run dev:remote`: starts Next.js using `.env.remote`.
- `npm run build`: runs `prisma generate` and creates a production Next.js build.
- `npm run start`: serves the production build.
- `npm run lint`: runs ESLint with Next.js core-web-vitals and TypeScript rules.
- `npm run db:generate`: regenerates Prisma Client.
- `npm run db:push:local` / `npm run db:seed:local`: syncs and seeds the local database.

## Coding Style & Naming Conventions
Use TypeScript strict mode and the `@/*` alias for repo-root imports. Prefer functional React components, server components by default in `app/`, and client components only when hooks, browser APIs, or interactivity require them. Name component files in PascalCase, hooks as `use-*.ts`, and utility modules in kebab-case or descriptive lowercase. Follow the existing 2-space indentation and double-quote style.

## Testing Guidelines
There is no dedicated test runner configured yet. Verify changes with `npm run lint`, `npm run build` when feasible, and targeted browser checks. For database changes, run `npm run db:generate` and the intended `db:push:*` command.

## Commit & Pull Request Guidelines
Recent history uses short imperative commits such as `fix: force dashboard routes dynamic`. Prefer prefixes like `fix:`, `feat:`, `docs:`, or `chore:` with a concise scope. Pull requests should include a summary, linked issue or task, verification commands, screenshots for UI changes, and notes for schema or environment-variable changes.

## Security & Configuration Tips
Never commit `.env*` files or secrets. Use `.env.example` for required variable names. Be explicit with local vs remote Prisma commands to avoid writing to production accidentally.

## Agent-Specific Instructions
Project state must be stored in `.codex/project.md`, `.codex/tasks.md`, and `.codex/log.md`. At the start of each step, read all three; after changes, update active tasks and append a concise log entry.
