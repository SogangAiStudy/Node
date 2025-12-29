# Node

A Node Graph-based collaboration tool that automatically surfaces bottlenecks and provides a "what to do now" view, with an official Request → Respond → Approve workflow.

## Features

- **Graph View**: Visual workflow with nodes and edges, auto-computed status (BLOCKED/WAITING/TODO/DOING/DONE)
- **Now View**: Personal queue showing "My Todos", "My Waiting", and "I'm Blocking Others"
- **Requests Inbox**: Structured info request workflow with approval mechanism
- **Status Auto-Derivation**: Automatically detects blocked and waiting states based on dependencies
- **Cycle Detection**: Prevents circular dependencies in DEPENDS_ON relationships

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React, TypeScript, TailwindCSS
- **UI Components**: shadcn/ui, React Flow
- **State Management**: TanStack Query
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5 with Google OAuth
- **Deployment**: Vercel-compatible

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (local or cloud)
- Google OAuth credentials (for authentication)

## Local Development Setup

### 1. Clone and Install Dependencies

```bash
npm install
npm install -D tsx @types/dagre
```

### 2. Set Up Database

Create a PostgreSQL database (locally or use a service like Supabase/Neon):

```bash
# If using local PostgreSQL
createdb bottleneck_radar
```

### 3. Configure Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/bottleneck_radar?schema=public"

# NextAuth
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (get from Google Cloud Console)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### 4. Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable Google+ API
4. Go to "Credentials" and create OAuth 2.0 Client ID
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy the Client ID and Client Secret to your `.env` file

### 5. Initialize Database

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push

# Seed with sample data
npm run db:seed
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Management

```bash
# Generate Prisma Client after schema changes
npm run db:generate

# Push schema changes to database (dev)
npm run db:push

# Create and run migrations (production)
npm run db:migrate

# Seed database with sample data
npm run db:seed

# Open Prisma Studio (database GUI)
npm run db:studio
```

## Deployment to Vercel

### 1. Set Up PostgreSQL Database

Use a cloud PostgreSQL provider:
- **Supabase** (recommended): https://supabase.com
- **Neon**: https://neon.tech
- **Railway**: https://railway.app

### 2. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### 3. Configure Environment Variables in Vercel

In your Vercel project dashboard, add the following environment variables:

- `DATABASE_URL`: Your PostgreSQL connection string
- `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
- `NEXTAUTH_URL`: Your production URL (e.g., `https://your-app.vercel.app`)
- `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret

**Important**: Update your Google OAuth settings:
- Add production redirect URI: `https://your-app.vercel.app/api/auth/callback/google`

### 4. Run Database Migrations

After deployment, run migrations:

```bash
# Connect to your production database
DATABASE_URL="your-production-db-url" npx prisma migrate deploy

# Optionally seed data
DATABASE_URL="your-production-db-url" npm run db:seed
```

## Core Concepts

### Node Types

- **TASK**: Regular work item
- **DECISION**: Requires decision making
- **BLOCKER**: Represents a blocking issue
- **INFOREQ**: Information request needed

### Edge Relations

- **DEPENDS_ON**: Node A depends on Node B (A waits for B to complete)
- **HANDOFF_TO**: Work handoff relationship
- **NEEDS_INFO_FROM**: Information dependency
- **APPROVAL_BY**: Requires approval

### Status Computation

Computed status follows this priority:

1. **BLOCKED**: Has DEPENDS_ON edge to non-DONE node
2. **WAITING**: Has OPEN/RESPONDED request OR APPROVAL_BY edge without approved request
3. Otherwise: Returns manual status (TODO/DOING/DONE)

### Request Workflow

1. **Create**: User creates a request linked to a node
2. **Respond**: Assignee provides a draft response
3. **Claim** (for team requests): Team member claims ownership
4. **Approve**: Assignee finalizes and approves the response
5. **Close**: Request can be closed at any time

## Sample Users (Development)

The seed script creates three test users:

- alice@example.com (Engineering team)
- bob@example.com (Design team)
- charlie@example.com (Marketing team)

## Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check firewall/network settings

### OAuth Issues

- Verify Google OAuth redirect URIs match your environment
- Check Client ID and Secret are correct
- Ensure Google+ API is enabled

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Regenerate Prisma Client
npm run db:generate

# Rebuild
npm run build
```

## License

MIT
