import "dotenv/config";
import { PrismaClient, NodeType, ManualStatus, EdgeRelation } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });


async function main() {
  console.log("Starting seed...");

  // Create test users
  const user1 = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      email: "alice@example.com",
      name: "Alice Johnson",
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: {
      email: "bob@example.com",
      name: "Bob Smith",
    },
  });

  const user3 = await prisma.user.upsert({
    where: { email: "charlie@example.com" },
    update: {},
    create: {
      email: "charlie@example.com",
      name: "Charlie Brown",
    },
  });

  console.log("Created users:", { user1, user2, user3 });

  // Create a project
  const project = await prisma.project.create({
    data: {
      name: "Product Launch Q1",
      members: {
        create: [
          { userId: user1.id, team: "Engineering" },
          { userId: user2.id, team: "Design" },
          { userId: user3.id, team: "Marketing" },
        ],
      },
    },
  });

  console.log("Created project:", project);

  // Create nodes
  const designMockups = await prisma.node.create({
    data: {
      projectId: project.id,
      title: "Create Design Mockups",
      description: "Design the UI/UX mockups for the new feature",
      type: NodeType.TASK,
      manualStatus: ManualStatus.DONE,
      ownerId: user2.id,
      team: "Design",
      priority: 1,
    },
  });

  const buildUI = await prisma.node.create({
    data: {
      projectId: project.id,
      title: "Build UI Components",
      description: "Implement the UI based on approved mockups",
      type: NodeType.TASK,
      manualStatus: ManualStatus.DOING,
      ownerId: user1.id,
      team: "Engineering",
      priority: 1,
    },
  });

  const buildBackend = await prisma.node.create({
    data: {
      projectId: project.id,
      title: "Build Backend API",
      description: "Create REST API endpoints",
      type: NodeType.TASK,
      manualStatus: ManualStatus.TODO,
      ownerId: user1.id,
      team: "Engineering",
      priority: 1,
    },
  });

  const testing = await prisma.node.create({
    data: {
      projectId: project.id,
      title: "QA Testing",
      description: "Test all features before launch",
      type: NodeType.TASK,
      manualStatus: ManualStatus.TODO,
      ownerId: user1.id,
      team: "Engineering",
      priority: 2,
    },
  });

  const marketingCopy = await prisma.node.create({
    data: {
      projectId: project.id,
      title: "Write Marketing Copy",
      description: "Prepare marketing materials",
      type: NodeType.TASK,
      manualStatus: ManualStatus.TODO,
      ownerId: user3.id,
      team: "Marketing",
      priority: 2,
    },
  });

  const legalApproval = await prisma.node.create({
    data: {
      projectId: project.id,
      title: "Legal Approval",
      description: "Get legal sign-off on terms and conditions",
      type: NodeType.DECISION,
      manualStatus: ManualStatus.TODO,
      team: "Legal",
      priority: 1,
    },
  });

  const launch = await prisma.node.create({
    data: {
      projectId: project.id,
      title: "Product Launch",
      description: "Go live with the new feature",
      type: NodeType.TASK,
      manualStatus: ManualStatus.TODO,
      ownerId: user3.id,
      priority: 1,
      dueAt: new Date("2025-03-01"),
    },
  });

  console.log("Created nodes");

  // Create edges (dependencies)
  await prisma.edge.createMany({
    data: [
      {
        projectId: project.id,
        fromNodeId: buildUI.id,
        toNodeId: designMockups.id,
        relation: EdgeRelation.DEPENDS_ON,
      },
      {
        projectId: project.id,
        fromNodeId: testing.id,
        toNodeId: buildUI.id,
        relation: EdgeRelation.DEPENDS_ON,
      },
      {
        projectId: project.id,
        fromNodeId: testing.id,
        toNodeId: buildBackend.id,
        relation: EdgeRelation.DEPENDS_ON,
      },
      {
        projectId: project.id,
        fromNodeId: launch.id,
        toNodeId: testing.id,
        relation: EdgeRelation.DEPENDS_ON,
      },
      {
        projectId: project.id,
        fromNodeId: launch.id,
        toNodeId: marketingCopy.id,
        relation: EdgeRelation.DEPENDS_ON,
      },
      {
        projectId: project.id,
        fromNodeId: launch.id,
        toNodeId: legalApproval.id,
        relation: EdgeRelation.APPROVAL_BY,
      },
    ],
  });

  console.log("Created edges");

  // Create requests
  const request1 = await prisma.request.create({
    data: {
      projectId: project.id,
      linkedNodeId: legalApproval.id,
      question: "Can you review the terms and conditions for legal compliance?",
      fromUserId: user1.id,
      toTeam: "Legal",
    },
  });

  const request2 = await prisma.request.create({
    data: {
      projectId: project.id,
      linkedNodeId: buildUI.id,
      question: "What color scheme should we use for the primary buttons?",
      fromUserId: user1.id,
      toUserId: user2.id,
      status: "RESPONDED",
      responseDraft: "Use #3B82F6 (blue-500) for primary buttons",
    },
  });

  console.log("Created requests:", { request1, request2 });

  // Create activity logs
  await prisma.activityLog.createMany({
    data: [
      {
        projectId: project.id,
        userId: user1.id,
        action: "CREATE_PROJECT",
        entityType: "PROJECT",
        entityId: project.id,
        details: { name: project.name },
      },
      {
        projectId: project.id,
        userId: user1.id,
        action: "CREATE_NODE",
        entityType: "NODE",
        entityId: designMockups.id,
        details: { title: designMockups.title },
      },
    ],
  });

  console.log("Created activity logs");
  console.log("Seed completed successfully!");
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
