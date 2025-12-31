# Service Architecture — Node (Bottleneck Radar)

This document describes the high-level architecture, data model, and core logic of the Node collaboration tool.

---

## 1. System Overview

**Node** is a specialized project management tool designed for teams that work in a dependency-heavy environment. Unlike linear lists, it models projects as a **Directed Acyclic Graph (DAG)** where:
- **Work items** are Nodes.
- **Dependencies and relations** are Edges.
- **Accountability** is enforced through an official Request/Respond/Approve workflow.

---

## 2. Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, Next.js 16 (App Router), TypeScript |
| **Styling** | TailwindCSS, shadcn/ui |
| **Graph UI** | React Flow (for interactive visualization) |
| **State Management** | TanStack Query (Server State), React Context (UI State) |
| **Backend** | Next.js API Routes (Serverless functions) |
| **ORM** | Prisma 7.2 |
| **Database** | PostgreSQL (Local & Supabase support) |
| **Authentication** | NextAuth.js (v5 Beta) |

---

## 3. Data Model (Prisma)

The system revolves around several core entities:

### Core Hierarchy
- **User**: Authentication and profile data.
- **Organization**: The top-level container. Users have roles (`ADMIN`, `MEMBER`) within an Org.
- **Team**: Groups within an organization that own specific nodes or projects.
- **Project**: A specific initiative within an organization. All nodes and edges belong to a project.

### Graph Components
- **Node**: Represent a task, decision, blocker, or info request.
  - *Attributes*: `title`, `type`, `manualStatus`, `priority`, `owner`.
- **Edge**: Defines relations between nodes (e.g., `DEPENDS_ON`, `HANDOFF_TO`).
  - *Status Derivation*: The system automatically calculates if a node is **BLOCKED** based on these edges.

### Accountability Workflow
- **Request**: A formal ask from one user/team to another.
  - *Workflow*: **OPEN** → **RESPONDED** (Draft) → **APPROVED** (Official) → **CLOSED**.
- **ActivityLog**: Auditable history of all major changes.

---

## 4. Key Logic & Algorithms

### 4.1 Status Auto-Derivation
The "Status" shown in the UI is often a calculated property (Derived Status):
- **BLOCKED**: One or more incoming `DEPENDS_ON` nodes are not yet `DONE`.
- **WAITING**: The current user is an owner, but the node is blocked or has an open request.
- **TODO / DOING**: Ready to work on.
- **DONE**: Manually marked by the owner.

### 4.2 Graph Layout & Visualization
- **Dagre**: Used in the background to calculate optimal X/Y coordinates for nodes to minimize edge crossings and ensure a logical top-to-bottom or left-to-right flow.
- **Cycle Detection**: The backend prevents creating an edge that would cause a loop in the dependency graph.

### 4.3 Environment Management
We use a targeted environment strategy:
- **`dotenv-cli`**: Used in `package.json` to switch between `.env.local` and `.env.remote`.
- **Prisma Adapters**: We use `@prisma/adapter-pg` to ensure compatibility with modern environments and serverless runtimes.

---

## 5. Security & Access Control
- **NextAuth Middleware**: Safeguards all pages and API routes.
- **Org-level Isolation**: Every database query includes an `orgId` check to ensure users can only see data belonging to their organization.
- **Project Membership**: Users must be members of a project to edit its nodes or edges.
