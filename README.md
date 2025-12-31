# Node (Bottleneck Radar) — Node Graph Collaboration Tool

A **Node Graph-based collaboration tool** that automatically surfaces bottlenecks and provides a **“what to do now”** view, with an official **Request → Respond → Approve** workflow.

---

## Project Overview

### Purpose
In collaboration, work often stalls because:
- It’s unclear **where the bottleneck is** (what is blocked by what),
- And unclear whether an answer is **official/final** or just a draft.

**Node** models work as **Nodes + Edges (relations)** and derives status automatically so you can instantly see:
- What you should do **now**
- What you are **waiting on**
- Who you are **blocking**

### Key Features
- **Graph View**: Visual workflow with nodes and edges, auto-computed status (**BLOCKED / WAITING / TODO / DOING / DONE**)
- **Now View**: Personal queue showing **My Todos**, **My Waiting**, and **I'm Blocking Others**
- **Requests Inbox**: Structured info request workflow with an approval mechanism
- **Status Auto-Derivation**: Detects blocked/waiting states based on dependencies
- **Cycle Detection**: Prevents circular dependencies in `DEPENDS_ON` relationships

### Tech Stack
- **Frontend**: Next.js (App Router), React, TypeScript, TailwindCSS
- **UI**: shadcn/ui, React Flow
- **State**: TanStack Query
- **Backend**: Next.js API Routes
- **DB**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js (Google OAuth optional for local)
- **Deployment**: Vercel-compatible

---

## Quick Start (Run Locally)

This guide is written so you can run the project **only by following this README**.

### Requirements (versions matter)

#### 1) Node.js (IMPORTANT)
Prisma `v7.2.0` requires **Node.js 20.19+ or 22.12+ or 24+**.

✅ Recommended: **Node.js 22.12+ (LTS)**

Check:
```bash
node -v
npm -v
```

> If you’re on `v22.11.x` (or older), `npm install` will fail for Prisma with an engine/version error.

#### 2) PostgreSQL
Any recent PostgreSQL works (you used `18.1`, which is OK).

Check:
```bash
psql --version
createdb --version
```

---

## 1) Install PostgreSQL (Windows)

1) Install PostgreSQL using the official Windows installer (EDB).
2) During install, ensure **Command Line Tools** are included (so `psql`, `createdb` are available).
3) Open a **new** terminal and verify:
```bash
psql --version
createdb --version
```

### If `createdb` / `psql` is “not recognized”
Add PostgreSQL `bin` to PATH (common path):
- `C:\Program Files\PostgreSQL\<version>\bin`

Then reopen terminal and re-check:
```bash
where psql
where createdb
```

---

## 2) Clone & install dependencies

```bash
git clone <YOUR_REPO_URL>
cd Node
npm install
```

> If you get Windows `EPERM` while deleting/installing, see **Troubleshooting → EPERM**.

---

## 3) Create local database (PostgreSQL)

### 3-1) Create DB
Create a database named `node_db`:

```bash
createdb -U postgres node_db
```

If it says the database already exists, that’s fine.

### 3-2) Test DB connection
```bash
psql -U postgres -d node_db -c "SELECT 1;"
```

---

## 4) Configure environment variables

Copy env:
```bash
cp .env.example .env
```

Windows alternative:
```bat
copy .env.example .env
```

Edit `.env` and set at least:

```env
# Database
DATABASE_URL="postgresql://postgres:<YOUR_POSTGRES_PASSWORD>@localhost:5432/node_db?schema=public"

# NextAuth (local dev)
NEXTAUTH_SECRET="generate-with-openssl-or-powershell"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (optional for local; required if you use Google login)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### Generate NEXTAUTH_SECRET
macOS/Linux:
```bash
openssl rand -base64 32
```

Windows (PowerShell):
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object {Get-Random -Max 256}))
```

👉 **Google OAuth how-to:** See [docs/google-auth.md](docs/google-auth.md) for a copy-paste guide to creating the credentials, wiring env vars, and triggering the Google sign-in/out buttons in your UI.

👉 **Local dev playbook:** See [docs/local-dev-playbook.md](docs/local-dev-playbook.md) for a copy-paste checklist to run any Next.js project with npm + PostgreSQL + Prisma, plus common Windows/macOS fixes.

---

## 5) Initialize the database

Run these in order:

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database (dev sync)
npm run db:push

# Seed with sample data
npm run db:seed
```

You should see: `Seed completed successfully!`

---

## 6) Run the development server

```bash
npm run dev
```

Open:
- http://localhost:3000

---

## Database Management (scripts)

```bash
# Generate Prisma Client after schema changes
npm run db:generate

# Push schema changes to database (dev)
npm run db:push

# Create and run migrations (production-style)
npm run db:migrate

# Seed database with sample data
npm run db:seed

# Open Prisma Studio (database GUI)
npm run db:studio
```

---

## Optional: Google OAuth setup (only if you use Google login)

1) Google Cloud Console → APIs & Services → Credentials  
2) Create OAuth 2.0 Client ID  
3) Add Authorized redirect URI (local):
- `http://localhost:3000/api/auth/callback/google`
4) Put the Client ID/Secret into `.env`

---

## Troubleshooting

### A) Prisma engine/version error (EBADENGINE)
Symptom:
- Prisma says Node must be `20.19+ / 22.12+ / 24+`

Fix:
```bash
node -v
```
Upgrade Node, then reinstall:
- macOS/Linux:
```bash
rm -rf node_modules package-lock.json
npm install
```
- Windows:
```bat
rmdir /s /q node_modules
del /f /q package-lock.json
npm install
```

### B) `createdb node_db` fails for user like your Windows username
By default `createdb` tries your OS username as a DB role, which usually doesn’t exist.

Fix:
```bash
createdb -U postgres node_db
```

### C) `createdb` / `psql` not recognized
PostgreSQL `bin` not in PATH. Add:
`C:\Program Files\PostgreSQL\<version>\bin`  
Then reopen terminal.

### D) Windows `EPERM` while removing node_modules
Close VSCode/terminals that might lock files, then:
```bat
taskkill /F /IM node.exe 2>nul
rmdir /s /q node_modules
```
If still stuck:
```bat
npx rimraf node_modules
```
Reboot as a last resort.

### E) Next.js warning: “multiple lockfiles / wrong workspace root”
If Next picks something like `C:\Users\<you>\package-lock.json` as the root, remove that unintended lockfile (if not needed):
```bat
del C:\Users\<YOU>\package-lock.json
```

### F) PowerShell shows broken Korean characters in Postgres errors
It’s usually console encoding. You can switch to UTF-8:
```powershell
chcp 65001
```

---

## Notes: `db:push` vs `db:migrate`
- `db:push` is convenient for **local dev** (fast, no migration history)
- `db:migrate` is recommended for **production/team workflows** (keeps migration history)
