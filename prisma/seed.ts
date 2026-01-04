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
  console.log(`Starting seed against: ${dbHost}`);
  if (dbHost.includes("supabase") || dbHost.includes("pooler")) {
    console.log("⚠️ WARNING: Running seed against REMOTE database!");
  }
  console.log("-----------------------------------------");

  // 1. Create test users
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

  // 2. Create an organization
  const org = await prisma.organization.upsert({
    where: { id: "demo-org-id" }, // Using a fixed ID for seed stability
    update: {
      name: "Demo Organization",
    },
    create: {
      id: "demo-org-id",
      name: "Demo Organization",
      ownerId: user1.id,
      members: {
        create: [
          { userId: user1.id, role: "ADMIN", status: "ACTIVE" },
          { userId: user2.id, role: "MEMBER", status: "ACTIVE" },
          { userId: user3.id, role: "MEMBER", status: "ACTIVE" },
        ]
      }
    },
  });

  console.log("Using organization:", org.name);

  // 3. Create a project
  const project = await prisma.project.upsert({
    where: { id: "demo-project-id" },
    update: {
      name: "Product Launch Q1",
    },
    create: {
      id: "demo-project-id",
      name: "Product Launch Q1",
      orgId: org.id,
      ownerId: user1.id,
    },
  });

  console.log("Using project:", project.name);

  // 3b. Create project members
  await prisma.projectMember.deleteMany({ where: { projectId: project.id } }); // Clear existing

  await prisma.projectMember.createMany({
    data: [
      { projectId: project.id, userId: user1.id, orgId: org.id },
      { projectId: project.id, userId: user2.id, orgId: org.id },
      { projectId: project.id, userId: user3.id, orgId: org.id },
    ],
    skipDuplicates: true,
  });

  // 4. Create nodes
  const designMockups = await prisma.node.upsert({
    where: { id: "node-design-mockups" },
    update: { manualStatus: ManualStatus.DONE },
    create: {
      id: "node-design-mockups",
      projectId: project.id,
      orgId: org.id,
      title: "Create Design Mockups",
      description: "Design the UI/UX mockups for the new feature",
      type: NodeType.TASK,
      manualStatus: ManualStatus.DONE,
      ownerId: user2.id,
      priority: 1,
    },
  });

  const buildUI = await prisma.node.upsert({
    where: { id: "node-build-ui" },
    update: { manualStatus: ManualStatus.DOING },
    create: {
      id: "node-build-ui",
      projectId: project.id,
      orgId: org.id,
      title: "Build UI Components",
      description: "Implement the UI based on approved mockups",
      type: NodeType.TASK,
      manualStatus: ManualStatus.DOING,
      ownerId: user1.id,
      priority: 1,
    },
  });

  const buildBackend = await prisma.node.upsert({
    where: { id: "node-build-backend" },
    update: {},
    create: {
      id: "node-build-backend",
      projectId: project.id,
      orgId: org.id,
      title: "Build Backend API",
      description: "Create REST API endpoints",
      type: NodeType.TASK,
      manualStatus: ManualStatus.TODO,
      ownerId: user1.id,
      priority: 1,
    },
  });

  const testing = await prisma.node.upsert({
    where: { id: "node-testing" },
    update: {},
    create: {
      id: "node-testing",
      projectId: project.id,
      orgId: org.id,
      title: "QA Testing",
      description: "Test all features before launch",
      type: NodeType.TASK,
      manualStatus: ManualStatus.TODO,
      ownerId: user1.id,
      priority: 2,
    },
  });

  const marketingCopy = await prisma.node.upsert({
    where: { id: "node-marketing-copy" },
    update: {},
    create: {
      id: "node-marketing-copy",
      projectId: project.id,
      orgId: org.id,
      title: "Write Marketing Copy",
      description: "Prepare marketing materials",
      type: NodeType.TASK,
      manualStatus: ManualStatus.TODO,
      ownerId: user3.id,
      priority: 2,
    },
  });

  const legalApproval = await prisma.node.upsert({
    where: { id: "node-legal-approval" },
    update: {},
    create: {
      id: "node-legal-approval",
      projectId: project.id,
      orgId: org.id,
      title: "Legal Approval",
      description: "Get legal sign-off on terms and conditions",
      type: NodeType.DECISION,
      manualStatus: ManualStatus.TODO,
      priority: 1,
    },
  });

  const launch = await prisma.node.upsert({
    where: { id: "node-launch" },
    update: { dueAt: new Date("2025-03-01") },
    create: {
      id: "node-launch",
      projectId: project.id,
      orgId: org.id,
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

  // 5. Create edges (dependencies)
  // delete existing edges to avoid unique constraint violations
  await prisma.edge.deleteMany({ where: { projectId: project.id } });

  await prisma.edge.createMany({
    data: [
      {
        projectId: project.id,
        orgId: org.id,
        fromNodeId: buildUI.id,
        toNodeId: designMockups.id,
        relation: EdgeRelation.DEPENDS_ON,
      },
      {
        projectId: project.id,
        orgId: org.id,
        fromNodeId: testing.id,
        toNodeId: buildUI.id,
        relation: EdgeRelation.DEPENDS_ON,
      },
      {
        projectId: project.id,
        orgId: org.id,
        fromNodeId: testing.id,
        toNodeId: buildBackend.id,
        relation: EdgeRelation.DEPENDS_ON,
      },
      {
        projectId: project.id,
        orgId: org.id,
        fromNodeId: launch.id,
        toNodeId: testing.id,
        relation: EdgeRelation.DEPENDS_ON,
      },
      {
        projectId: project.id,
        orgId: org.id,
        fromNodeId: launch.id,
        toNodeId: marketingCopy.id,
        relation: EdgeRelation.DEPENDS_ON,
      },
      {
        projectId: project.id,
        orgId: org.id,
        fromNodeId: launch.id,
        toNodeId: legalApproval.id,
        relation: EdgeRelation.APPROVAL_BY,
      },
    ],
  });

  console.log("Created edges");

  // 6. Create requests
  await prisma.request.upsert({
    where: { id: "req-legal-review" },
    update: {},
    create: {
      id: "req-legal-review",
      projectId: project.id,
      orgId: org.id,
      linkedNodeId: legalApproval.id,
      question: "Can you review the terms and conditions for legal compliance?",
      fromUserId: user1.id,
      toTeam: "Legal",
    },
  });

  await prisma.request.upsert({
    where: { id: "req-ui-color" },
    update: {},
    create: {
      id: "req-ui-color",
      projectId: project.id,
      orgId: org.id,
      linkedNodeId: buildUI.id,
      question: "What color scheme should we use for the primary buttons?",
      fromUserId: user1.id,
      toUserId: user2.id,
      status: "RESPONDED",
      responseDraft: "Use #3B82F6 (blue-500) for primary buttons",
    },
  });

  console.log("Created requests");

  // 7. Create activity logs
  await prisma.activityLog.createMany({
    data: [
      {
        projectId: project.id,
        orgId: org.id,
        userId: user1.id,
        action: "CREATE_PROJECT",
        entityType: "PROJECT",
        entityId: project.id,
        details: { name: project.name },
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
