# 🛰️ Node (Bottleneck Radar)

A powerful **Node Graph-based collaboration tool** designed to eliminate project stalls. It visualizes dependencies, surfaces bottlenecks, and provides a clear **"What to do now"** queue for every team member.

[![Next.js](https://img.shields.io/badge/Next.js-15.0-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.2-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![React Flow](https://img.shields.io/badge/React_Flow-11.11-FF6060?style=flat-square)](https://reactflow.dev/)

---

## 🎨 Overview

Traditional task lists fail when dependencies get complex. **Node** turns your workflow into a **Directed Acyclic Graph (DAG)**, automatically calculating statuses like `BLOCKED` or `WAITING` based on official handoffs.

- **Graph View**: Interactive visualization of the entire project workflow.
- **Now View**: A prioritized personal inbox of what you can actually work on *today*.
- **Request Workflow**: An official **Ask → Respond → Approve** mechanism for technical decisions.
- **Auto-Derivation**: Real-time dependency tracking—know exactly who you are blocking.

---

## 🚀 Quick Start

### 1. Requirements
- **Node.js**: `v20.19+` or `v22.12+` (Required for Prisma 7)
- **PostgreSQL**: `v15+`

### 2. Installation
```bash
git clone <repository-url>
cd Node
npm install
```

### 3. Database & Environment Setup

#### Step A: Create Local Database & User
Run these in your terminal to prepare PostgreSQL:

**🍎 macOS / 🐧 Linux:**
```bash
# 1. Create a 'postgres' role
psql -d postgres -c "CREATE ROLE postgres WITH LOGIN SUPERUSER PASSWORD 'postgres';"

# 2. Create the project database
createdb node_db
```

**🪟 Windows (cmd/PowerShell):**
```powershell
# 1. Create a 'postgres' role
psql -U postgres -d postgres -c "CREATE ROLE postgres WITH LOGIN SUPERUSER PASSWORD 'postgres';"

# 2. Create the project database
createdb -U postgres node_db
```

#### Step B: Configure environment files
```bash
# Copy the template
cp .env.example .env.local
cp .env.example .env.remote
```

Edit `.env.local` with the credentials created above:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/node_db?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/node_db?schema=public"

# Generate AUTH_SECRET with: openssl rand -base64 32
AUTH_SECRET="your-secret" 

GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

### 4. Database Initialization
Initialize your **Local Database** (Run these after Step A/B):

```bash
# 1. Generate Prisma client
npm run db:generate

# 2. Sync the schema (Create tables)
npm run db:push:local

# 3. Seed with sample data
npm run db:seed:local
```

### 5. Launch
```bash
# Run the app against local DB
npm run dev:local
```
Access the app at [http://localhost:3000](http://localhost:3000).

---

## 🛠️ Database Management

We use `dotenv-cli` for explicit environment targeting. **Never accidentally write to production again.**

| Command | Local Target (`.env.local`) | Remote Target (`.env.remote`) |
| :--- | :--- | :--- |
| **Development** | `npm run dev:local` | `npm run dev:remote` |
| **Push Schema** | `npm run db:push:local` | `npm run db:push:remote` |
| **Seed Data** | `npm run db:seed:local` | `npm run db:seed:remote` |
| **Prisma Studio** | `npm run db:studio:local` | `npm run db:studio:remote` |

---

## 🏗️ Architecture

For a deep dive into the service design, data models (DAG), and status derivation logic, see [architecture.md](./architecture.md).

---

## ❓ Troubleshooting

<details>
<summary><b>Prisma Engine / Version Error (EBADENGINE)</b></summary>
Ensure `node -v` returns 20.19+ or 22.12+. If you just upgraded, delete `node_modules` and run `npm install` again.
</details>

<details>
<summary><b>Database Access Denied (P1010)</b></summary>
The default password for Postgres might be your login password or 'postgres'.
Check <code>psql -U postgres</code>. If that fails, connect as your OS user and create the role:
<code>psql -d postgres -c "CREATE ROLE postgres WITH LOGIN SUPERUSER PASSWORD 'postgres';"</code>
</details>

<details>
<summary><b>Google Auth Callback Error</b></summary>
Ensure your redirect URI in Google Cloud Console matches exactly:
<code>http://localhost:3000/api/auth/callback/google</code>
</details>

<details>
<summary><b>Windows File Errors (EPERM)</b></summary>
Close any process locking the files (VSCode, another terminal) and run:
<code>taskkill /F /IM node.exe</code> then retry.
</details>

---

Made with ❤️ by the Node Team