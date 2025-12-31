# Local Dev Playbook: npm + PostgreSQL + Prisma (Next.js)

Use this as a drop-in checklist to spin up **any** Next.js/Node project in minutes without hunting for scattered wiki pages. It assumes the stack used here: **npm + PostgreSQL (local) + Prisma + Next.js**.

---

## 1) Why start with npm?
- **Standard muscle memory**: `npm install` + `npm run dev` works the same for everyone.
- **Reproducible**: `package-lock.json` locks versions → fewer "works on my machine" surprises.
- **No global installs**: `npx prisma ...` runs the project-pinned CLI version.

> Bottom line: default to npm unless your team has a specific alternative policy.

---

## 2) What DB are we using?
A **local PostgreSQL server** on `localhost:5432` (not a single-file SQLite DB). It mirrors how you'll run in staging/production.

---

## 3) Why pick PostgreSQL over SQLite?
- **Closer to production**: most deployed apps use Postgres → fewer surprises when shipping.
- **Concurrency & transactions**: safer for collaborative workflows (requests → responses → approvals).
- **Scaling headroom**: indexes, query tuning, and extensions are first-class.
- **Prisma-friendly**: schema/migration workflows stay tidy.

**Future-proofing:** Once your schema is solid locally, you can flip `DATABASE_URL` to a managed Postgres provider (e.g., **Neon**) without code changes.

---

## 4) Version checks (critical)
- **Node.js**: Prisma `7.x` requires **22.12+** (20.19+ also works). Check with:
  ```bash
  node -v
  npm -v
  ```
- **PostgreSQL CLI**: ensure `psql` and `createdb` exist:
  ```bash
  psql --version
  createdb --version
  ```

---

## 5) Universal run path (works for this repo and most clones)
**Read `package.json` → `scripts` first** in case names differ. Defaults here:

### A) Install dependencies
```bash
npm install
```

### B) Create a local database (first time only)
```bash
createdb -U postgres node_db
psql -U postgres -d node_db -c "SELECT 1;"
```

### C) Configure `.env`
```bash
cp .env.example .env     # Windows: copy .env.example .env
```
Set at least:
```env
DATABASE_URL="postgresql://postgres:<PASSWORD>@localhost:5432/node_db?schema=public"
```
Add `NEXTAUTH_*` and `GOOGLE_*` only if you need auth locally.

### D) Prisma schema → database (pick one)
- **Fast dev sync (no migration history):**
  ```bash
  npx prisma generate
  npx prisma db push
  ```
- **Team/production style (keeps history):**
  ```bash
  npx prisma generate
  npx prisma migrate dev --name init
  ```

### E) Seed data (if available)
```bash
npm run db:seed
```

### F) Start Next.js dev server
```bash
npm run dev
# open http://localhost:3000
```

---

## 6) Troubleshooting (battle-tested)

### 6-1) Prisma EBADENGINE (Node version)
- **Symptom:** "Prisma only supports Node.js versions …"
- **Fix:** Upgrade Node to 22.12+ (or 20.19+), then reinstall:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```
  Windows variant:
  ```bat
  rmdir /s /q node_modules
  del /f /q package-lock.json
  npm install
  ```

### 6-2) Windows EPERM deleting `node_modules`
```bat
taskkill /F /IM node.exe 2>nul
rmdir /s /q node_modules
del /f /q package-lock.json
npm install
```
Fallback:
```bat
npx rimraf node_modules
```

### 6-3) `createdb` / `psql` not recognized
- Add PostgreSQL `bin` to PATH, e.g. `C:\\Program Files\\PostgreSQL\\<version>\\bin`.
- Reopen your terminal and re-check with `where psql` / `where createdb`.

### 6-4) `createdb node_db` picks the wrong user
- Force the postgres role:
  ```bash
  createdb -U postgres node_db
  ```
- Or set your shell default:
  ```powershell
  $env:PGUSER="postgres"
  ```

### 6-5) Next.js warning about extra lockfiles / wrong root
- Delete stray `package-lock.json` files outside the project root (e.g., in your home directory).

---

## 7) Copy-paste "one shot" template
```bash
npm install
createdb -U postgres node_db
cp .env.example .env
npx prisma generate
npx prisma db push            # or: npx prisma migrate dev --name init
npm run db:seed               # if available
npm run dev
```

---

## 8) Deploy tip: switch to Neon later
1) Create a Neon Postgres database and copy its connection string.
2) Replace `DATABASE_URL` in `.env` with the Neon string.
3) Apply schema:
   ```bash
   npx prisma migrate deploy   # if you have migration history
   # or run db push once if you're still prototype-only
   ```
