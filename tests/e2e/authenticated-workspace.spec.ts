import { expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/db/prisma";

const runDbE2E = process.env.RUN_DB_E2E === "1";
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${process.env.E2E_PORT || 3000}`;

test.describe("authenticated workspace flow", () => {
  test.skip(!runDbE2E, "Set RUN_DB_E2E=1 with a disposable DATABASE_URL and AUTH_SECRET to run DB-backed e2e tests.");

  test("authenticated user can reach workspace projects and task graph", async ({ page, context }) => {
    const now = Date.now();
    const email = `e2e-${now}@node.local`;
    const sessionToken = await encode({
      token: {
        sub: `e2e-user-${now}`,
        name: "E2E User",
        email,
      },
      secret: process.env.AUTH_SECRET!,
      salt: "authjs.session-token",
    });

    const user = await prisma.user.create({
      data: {
        id: `e2e-user-${now}`,
        name: "E2E User",
        email,
      },
    });

    const org = await prisma.organization.create({
      data: {
        name: `E2E Org ${now}`,
        ownerId: user.id,
        inviteCode: `e2e-${now}`,
      },
    });

    const team = await prisma.team.create({
      data: {
        orgId: org.id,
        name: "Default",
        isDefault: true,
      },
    });

    await prisma.orgMember.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });

    await prisma.teamMember.create({
      data: {
        orgId: org.id,
        teamId: team.id,
        userId: user.id,
        role: "LEAD",
      },
    });

    const project = await prisma.project.create({
      data: {
        orgId: org.id,
        ownerId: user.id,
        primaryTeamId: team.id,
        name: `E2E Project ${now}`,
      },
    });

    await prisma.projectMember.create({
      data: {
        orgId: org.id,
        projectId: project.id,
        userId: user.id,
        role: "PROJECT_ADMIN",
      },
    });

    const node = await prisma.node.create({
      data: {
        orgId: org.id,
        projectId: project.id,
        teamId: team.id,
        ownerId: user.id,
        title: "E2E Task",
        description: "Created by DB-backed e2e setup",
      },
    });

    await context.addCookies([
      {
        name: "authjs.session-token",
        value: sessionToken,
        url: baseURL,
        httpOnly: true,
        sameSite: "Lax",
        expires: Math.floor(Date.now() / 1000) + 60 * 60,
      },
    ]);

    try {
      await page.goto(`/org/${org.id}/projects`);
      await expect(page.getByRole("link", { name: project.name, exact: true })).toBeVisible();

      await page.goto(`/org/${org.id}/projects/${project.id}/graph?nodeId=${node.id}`);
      await expect(page.getByRole("heading", { name: "E2E Task" })).toBeVisible({ timeout: 15_000 });
    } finally {
      await prisma.organization.delete({ where: { id: org.id } }).catch(() => null);
      await prisma.user.delete({ where: { id: user.id } }).catch(() => null);
      await prisma.$disconnect();
    }
  });
});
