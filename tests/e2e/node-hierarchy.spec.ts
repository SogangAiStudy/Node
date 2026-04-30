import { expect, request as playwrightRequest, test, type APIRequestContext } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/db/prisma";

const runDbE2E = process.env.RUN_DB_E2E === "1";
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${process.env.E2E_PORT || 3000}`;

async function apiFor(user: { id: string; email: string; name: string }) {
  const tokenPayload = {
    sub: user.id,
    name: user.name,
    email: user.email,
  };
  const sessionToken = await encode({
    token: tokenPayload,
    secret: process.env.AUTH_SECRET!,
    salt: "authjs.session-token",
  });
  const secureSessionToken = await encode({
    token: tokenPayload,
    secret: process.env.AUTH_SECRET!,
    salt: "__Secure-authjs.session-token",
  });

  return playwrightRequest.newContext({
    baseURL,
    extraHTTPHeaders: {
      cookie: `authjs.session-token=${sessionToken}; __Secure-authjs.session-token=${secureSessionToken}`,
    },
  });
}

test.describe("node hierarchy", () => {
  test.skip(!runDbE2E, "Set RUN_DB_E2E=1 with a disposable DATABASE_URL and AUTH_SECRET to run DB-backed e2e tests.");

  test("creates, moves, detaches, and rejects cycles for nested nodes", async () => {
    test.setTimeout(120_000);

    const now = Date.now();
    const prefix = `e2e-hierarchy-${now}`;
    const user = {
      id: `${prefix}-admin`,
      name: "E2E Hierarchy Admin",
      email: `${prefix}-admin@node.local`,
    };

    let orgId: string | null = null;
    const apiContexts: APIRequestContext[] = [];

    try {
      await prisma.user.create({ data: user });

      const org = await prisma.organization.create({
        data: {
          name: `E2E Hierarchy Org ${now}`,
          ownerId: user.id,
          inviteCode: prefix,
        },
      });
      orgId = org.id;

      const team = await prisma.team.create({
        data: {
          orgId: org.id,
          name: `${prefix}-team`,
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
          name: `E2E Hierarchy Project ${now}`,
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

      const adminApi = await apiFor(user);
      apiContexts.push(adminApi);

      const parentCreate = await adminApi.post(`/api/projects/${project.id}/nodes`, {
        data: { title: "Parent block" },
      });
      expect(parentCreate.status()).toBe(201);
      const parent = await parentCreate.json();

      const childCreate = await adminApi.post(`/api/projects/${project.id}/nodes`, {
        data: { title: "Nested block", parentNodeId: parent.id },
      });
      expect(childCreate.status()).toBe(201);
      const child = await childCreate.json();
      expect(child.parentNodeId).toBe(parent.id);

      const graph = await adminApi.get(`/api/projects/${project.id}/graph`);
      expect(graph.status()).toBe(200);
      const graphBody = await graph.json();
      const graphParent = graphBody.nodes.find((node: { id: string }) => node.id === parent.id);
      const graphChild = graphBody.nodes.find((node: { id: string }) => node.id === child.id);
      expect(graphParent.childCount).toBe(1);
      expect(graphChild.parentNodeId).toBe(parent.id);

      const cycleAttempt = await adminApi.patch(`/api/nodes/${parent.id}`, {
        data: { parentNodeId: child.id },
      });
      expect(cycleAttempt.status()).toBe(400);

      const detach = await adminApi.patch(`/api/nodes/${child.id}`, {
        data: {
          parentNodeId: null,
          positionX: 420,
          positionY: 180,
        },
      });
      expect(detach.status()).toBe(200);
      const detachedChild = await detach.json();
      expect(detachedChild.parentNodeId).toBeNull();
    } finally {
      for (const api of apiContexts) {
        await api.dispose();
      }
      if (orgId) {
        await prisma.organization.delete({ where: { id: orgId } }).catch(() => null);
      }
      await prisma.user.delete({ where: { id: user.id } }).catch(() => null);
      await prisma.$disconnect();
    }
  });
});
