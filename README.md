# Node (Bottleneck Radar) — Local Run Guide

A Node Graph-based collaboration tool that automatically surfaces bottlenecks and provides a **Request → Respond → Approve** workflow.

This README is written so you can run the project **only by following it** (Windows-first, with macOS/Linux notes).

---

## 0) What you need (versions matter)

### Node.js (IMPORTANT)
Prisma `v7.2.0` requires **Node.js 20.19+ or 22.12+ or 24+**.

✅ Recommended: **Node.js 22.12+ (LTS)**  
Check:
```bash
node -v
npm -v
```

If you see `v22.11.x` (or older), Prisma install will fail with “only supports Node.js versions 20.19+, 22.12+, 24+”.

### PostgreSQL
Any recent PostgreSQL works (you used `18.1`, which is OK).  
Check:
```bash
psql --version
createdb --version
```

---

## 1) Install PostgreSQL (Windows)

1. Install PostgreSQL from the official installer (EDB)
2. During install, make sure **Command Line Tools** are included (so `psql`, `createdb` exist).
3. After installation, open a **new** PowerShell/Terminal and verify:
```bash
psql --version
createdb --version
```

> If `createdb` is “not recognized”, add PostgreSQL `bin` to PATH (usually `C:\Program Files\PostgreSQL\<version>\bin`) and reopen terminal.

---

## 2) Clone & install dependencies

```bash
git clone <YOUR_REPO_URL>
cd Node
npm install
```

If your project requires extra dev deps (some setups do), run:
```bash
npm install -D tsx @types/dagre
```

---

## 3) Create local database (PostgreSQL)

### 3-1) Create DB (recommended: use postgres user)
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

Copy env file:
```bash
cp .env.example .env
```

> Windows PowerShell also supports `cp` as an alias. If not, use:
> `copy .env.example .env`

Edit `.env` and set at least:

```env
# Database (example)
DATABASE_URL="postgresql://postgres:<YOUR_POSTGRES_PASSWORD>@localhost:5432/node_db?schema=public"

# NextAuth
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (optional for local; required if you use Google login)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### Generate NEXTAUTH_SECRET
- macOS/Linux:
```bash
openssl rand -base64 32
```
- Windows (PowerShell):
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object {Get-Random -Max 256}))
```

---

## 5) Initialize DB schema + seed

Run these in order:

```bash
# 1) Generate Prisma Client
npm run db:generate

# 2) Sync schema to database (dev)
npm run db:push

# 3) Insert sample data
npm run db:seed
```

You should see logs like “Seed completed successfully!”.

---

## 6) Run the development server

```bash
npm run dev
```

Open:
- http://localhost:3000

---

## 7) Database management scripts

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

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID
3. Add redirect URI:
   - Local: `http://localhost:3000/api/auth/callback/google`
4. Put Client ID/Secret into `.env`

---

## Troubleshooting

### A) Prisma EBADENGINE / “Prisma only supports Node.js versions …”
✅ Fix: upgrade Node to **22.12+** (or 20.19+/24+), then reinstall:
```bash
node -v
rm -rf node_modules package-lock.json
npm install
```
Windows:
```bat
rmdir /s /q node_modules
del /f /q package-lock.json
npm install
```

### B) `createdb node_db` asks password and fails for user like `wjddb`
By default, `createdb` tries your OS username as DB role. Use postgres explicitly:
```bash
createdb -U postgres node_db
```

### C) `createdb` / `psql` not recognized
PostgreSQL `bin` not in PATH. Add:
`C:\Program Files\PostgreSQL\<version>\bin`  
Then reopen terminal.

### D) Next.js warning about “multiple lockfiles / wrong workspace root”
If you see something like:
- selected root = `C:\Users\<you>\package-lock.json`
- detected additional lockfile in your repo

✅ Fix: remove the unintended lockfile in your home directory if it’s not needed:
```bat
del C:\Users\<YOU>\package-lock.json
```
Then run `npm run dev` again.

### E) Weird broken Korean text in errors (PowerShell encoding)
Use Windows Terminal/PowerShell 7, or set UTF-8:
```powershell
chcp 65001
```

---

## Notes on “push” vs “migrate”
- `db:push` is convenient for **local dev** (no migration history)
- `db:migrate` is recommended for **production/team workflows** (keeps migration history)
