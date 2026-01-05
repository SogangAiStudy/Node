import { PrismaClient, NodeType, ManualStatus, EdgeRelation } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const dbUrl = process.env.DATABASE_URL || "";
  const dbHost = dbUrl.split("@")[1]?.split("/")[0] || "unknown";

  console.log("-----------------------------------------");
  console.log(`Starting onboarding seed against: ${dbHost}`);
  console.log("-----------------------------------------");

  // 1. Create/Find AI bot or system user
  const systemUser = await prisma.user.upsert({
    where: { email: "assistant@node.ai" },
    update: {},
    create: {
      email: "assistant@node.ai",
      name: "Node AI Assistant",
    },
  });

  // 1.1 Create Fake Users
  const fakeUsersData = [
    { email: "alice@node.ai", name: "Alice (Designer)" },
    { email: "bob@node.ai", name: "Bob (Backend)" },
    { email: "charlie@node.ai", name: "Charlie (Frontend)" },
    { email: "dana@node.ai", name: "Dana (Marketing)" },
  ];

  const fakeUsers: Record<string, any> = {};
  for (const u of fakeUsersData) {
    fakeUsers[u.email] = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: { email: u.email, name: u.name },
    });
  }

  // 2. Create the "Getting Started" Organization
  const org = await prisma.organization.upsert({
    where: { id: "demo-org-id" },
    update: {
      name: "👋 Getting Started",
      inviteCode: "GETTING_STARTED",
    },
    create: {
      id: "demo-org-id",
      name: "👋 Getting Started",
      ownerId: systemUser.id,
      inviteCode: "GETTING_STARTED",
    },
  });

  // 2.1 Add Fake Users to Org
  for (const email of Object.keys(fakeUsers)) {
    await prisma.orgMember.upsert({
      where: {
        orgId_userId: {
          orgId: org.id,
          userId: fakeUsers[email].id,
        },
      },
      update: { role: "MEMBER", status: "ACTIVE" },
      create: {
        orgId: org.id,
        userId: fakeUsers[email].id,
        role: "MEMBER",
        status: "ACTIVE",
      },
    });

    // Also create inbox state for them
    await prisma.orgInboxState.upsert({
      where: {
        orgId_userId: {
          orgId: org.id,
          userId: fakeUsers[email].id,
        },
      },
      update: {},
      create: {
        orgId: org.id,
        userId: fakeUsers[email].id,
      },
    });
  }

  console.log("Created Organization and Mock Members");

  // 3. Create Teams
  const teamsData = [
    { id: "team-design", name: "🎨 Product Design", description: "UI/UX and Brand Design", members: ["alice@node.ai"] },
    { id: "team-backend", name: "⚙️ Backend Engine", description: "API, Database, and Infrastructure", members: ["bob@node.ai"] },
    { id: "team-frontend", name: "💻 Frontend Studio", description: "Web and Mobile App Development", members: ["charlie@node.ai"] },
    { id: "team-marketing", name: "🚀 Growth Marketing", description: "User acquisition and Retention", members: ["dana@node.ai"] },
  ];

  for (const t of teamsData) {
    const team = await prisma.team.upsert({
      where: { id: t.id },
      update: { name: t.name, description: t.description },
      create: {
        id: t.id,
        orgId: org.id,
        name: t.name,
        description: t.description,
      },
    });

    // Add members to team
    for (const email of t.members) {
      await prisma.teamMember.upsert({
        where: {
          orgId_teamId_userId: {
            orgId: org.id,
            teamId: team.id,
            userId: fakeUsers[email].id,
          },
        },
        update: { role: "MEMBER" },
        create: {
          orgId: org.id,
          teamId: team.id,
          userId: fakeUsers[email].id,
          role: "MEMBER",
        },
      });
    }
  }

  // 4. Create "Project: New Feature Launch"
  const project = await prisma.project.upsert({
    where: { id: "onboarding-project-id" },
    update: { name: "🚀 New Feature Launch" },
    create: {
      id: "onboarding-project-id",
      name: "🚀 New Feature Launch",
      orgId: org.id,
      ownerId: systemUser.id,
      description: "A comprehensive project showing how Node manages complex dependencies.",
    },
  });

  console.log("Created Onboarding Project and Team Memberships");

  // 5. Create Nodes demonstrating a clear workflow
  const nodes = [
    {
      id: "node-1-research",
      title: "Market Research",
      type: NodeType.TASK,
      status: ManualStatus.DONE,
      teamId: "team-marketing",
      ownerId: fakeUsers["dana@node.ai"].id,
      participantIds: [fakeUsers["alice@node.ai"].id],
      x: 1590, y: 150
    },
    {
      id: "node-2-specs",
      title: "Product Specs",
      type: NodeType.TASK,
      status: ManualStatus.DONE,
      teamId: "team-design",
      ownerId: fakeUsers["alice@node.ai"].id,
      participantIds: [],
      x: 360, y: 195
    },
    {
      id: "node-3-ui",
      title: "UI Design",
      type: NodeType.TASK,
      status: ManualStatus.DOING,
      teamId: "team-design",
      ownerId: fakeUsers["alice@node.ai"].id,
      participantIds: [],
      x: 0, y: -120
    },
    {
      id: "node-4-api",
      title: "API Design",
      type: NodeType.TASK,
      status: ManualStatus.DOING,
      teamId: "team-backend",
      ownerId: fakeUsers["bob@node.ai"].id,
      participantIds: [],
      x: -15, y: 375
    },
    {
      id: "node-5-frontend",
      title: "Frontend Dev",
      type: NodeType.TASK,
      status: ManualStatus.TODO,
      teamId: "team-frontend",
      ownerId: fakeUsers["charlie@node.ai"].id,
      participantIds: [],
      x: 1275, y: -135
    },
    {
      id: "node-6-backend",
      title: "Backend Dev",
      type: NodeType.TASK,
      status: ManualStatus.TODO,
      teamId: "team-backend",
      ownerId: fakeUsers["bob@node.ai"].id,
      participantIds: [],
      x: 1275, y: 345
    },
    {
      id: "node-7-qa",
      title: "QA & Bug Fixes",
      type: NodeType.TASK,
      status: ManualStatus.TODO,
      teamId: "team-frontend",
      ownerId: fakeUsers["charlie@node.ai"].id,
      participantIds: [fakeUsers["bob@node.ai"].id],
      x: 690, y: 45
    },
    {
      id: "node-8-launch-choice",
      title: "Launch Go/No-Go?",
      type: NodeType.DECISION,
      status: ManualStatus.TODO,
      teamId: "team-marketing",
      ownerId: fakeUsers["dana@node.ai"].id,
      participantIds: [fakeUsers["alice@node.ai"].id],
      x: -15, y: 75
    },
  ];

  for (const n of nodes) {
    const node = await prisma.node.upsert({
      where: { id: n.id },
      update: {
        title: n.title,
        manualStatus: n.status,
        teamId: n.teamId,
        ownerId: n.ownerId,
        positionX: n.x,
        positionY: n.y
      },
      create: {
        id: n.id,
        projectId: project.id,
        orgId: org.id,
        title: n.title,
        type: n.type,
        manualStatus: n.status,
        teamId: n.teamId,
        ownerId: n.ownerId,
        positionX: n.x,
        positionY: n.y
      },
    });

    // Set participants (owners in many-to-many table)
    // Clear existing
    await prisma.nodeOwner.deleteMany({ where: { nodeId: node.id } });

    // Create new ones including the primary owner
    const allOwners = Array.from(new Set([n.ownerId, ...n.participantIds]));
    for (const oid of allOwners) {
      await prisma.nodeOwner.create({
        data: {
          nodeId: node.id,
          userId: oid,
        },
      });
    }

    // Set node teams
    await prisma.nodeTeam.deleteMany({ where: { nodeId: node.id } });
    if (n.teamId) {
      await prisma.nodeTeam.create({
        data: {
          nodeId: node.id,
          teamId: n.teamId,
        },
      });
    }
  }

  // 6. Create Edges
  await prisma.edge.deleteMany({ where: { projectId: project.id } });
  const edges = [
    { from: "node-1-research", to: "node-2-specs", rel: EdgeRelation.DEPENDS_ON },
    { from: "node-2-specs", to: "node-3-ui", rel: EdgeRelation.DEPENDS_ON },
    { from: "node-2-specs", to: "node-4-api", rel: EdgeRelation.DEPENDS_ON },
    { from: "node-3-ui", to: "node-5-frontend", rel: EdgeRelation.HANDOFF_TO },
    { from: "node-4-api", to: "node-6-backend", rel: EdgeRelation.HANDOFF_TO },
    { from: "node-5-frontend", to: "node-7-qa", rel: EdgeRelation.DEPENDS_ON },
    { from: "node-6-backend", to: "node-7-qa", rel: EdgeRelation.DEPENDS_ON },
    { from: "node-7-qa", to: "node-8-launch-choice", rel: EdgeRelation.APPROVAL_BY },
  ];

  await prisma.edge.createMany({
    data: edges.map(e => ({
      projectId: project.id,
      orgId: org.id,
      fromNodeId: e.from,
      toNodeId: e.to,
      relation: e.rel
    }))
  });

  console.log("Created Nodes, Edges and Assignments for Onboarding");
  console.log("✅ Onboarding seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
