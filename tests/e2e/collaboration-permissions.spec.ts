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
    token: {
      ...tokenPayload,
    },
    secret: process.env.AUTH_SECRET!,
    salt: "authjs.session-token",
  });
  const secureSessionToken = await encode({
    token: {
      ...tokenPayload,
    },
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

async function expectStatus(response: { status(): number }, status: number) {
  expect(response.status()).toBe(status);
}

test.describe("group collaboration and permissions", () => {
  test.skip(!runDbE2E, "Set RUN_DB_E2E=1 with a disposable DATABASE_URL and AUTH_SECRET to run DB-backed e2e tests.");

  test("enforces team, direct-member, viewer, and outsider access on collaboration APIs", async () => {
    test.setTimeout(180_000);

    await prisma.organization.deleteMany({
      where: { name: { startsWith: "E2E Collaboration Org" } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: "e2e-collab-" } },
    });

    const now = Date.now();
    const prefix = `e2e-collab-${now}`;
    const users = {
      admin: { id: `${prefix}-admin`, name: "E2E Admin", email: `${prefix}-admin@node.local` },
      editor: { id: `${prefix}-editor`, name: "E2E Editor", email: `${prefix}-editor@node.local` },
      viewer: { id: `${prefix}-viewer`, name: "E2E Viewer", email: `${prefix}-viewer@node.local` },
      blocked: { id: `${prefix}-blocked`, name: "E2E Blocked", email: `${prefix}-blocked@node.local` },
      invitee: { id: `${prefix}-invitee`, name: "E2E Invitee", email: `${prefix}-invitee@node.local` },
      deactivated: { id: `${prefix}-deactivated`, name: "E2E Deactivated", email: `${prefix}-deactivated@node.local` },
      external: { id: `${prefix}-external`, name: "E2E External", email: `${prefix}-external@node.local` },
    };
    const userIds = Object.values(users).map((user) => user.id);
    const apiContexts: APIRequestContext[] = [];

    let orgId: string | null = null;
    let projectId: string | null = null;

    try {
      await prisma.user.createMany({ data: Object.values(users) });

      const org = await prisma.organization.create({
        data: {
          name: `E2E Collaboration Org ${now}`,
          ownerId: users.admin.id,
          inviteCode: prefix,
        },
      });
      orgId = org.id;

      const [editorTeam, viewerTeam, spareTeam] = await Promise.all([
        prisma.team.create({ data: { orgId: org.id, name: `${prefix}-editors`, isDefault: true } }),
        prisma.team.create({ data: { orgId: org.id, name: `${prefix}-viewers` } }),
        prisma.team.create({ data: { orgId: org.id, name: `${prefix}-spare` } }),
      ]);

      await prisma.orgMember.createMany({
        data: [
          { orgId: org.id, userId: users.admin.id, role: "ADMIN", status: "ACTIVE" },
          { orgId: org.id, userId: users.editor.id, role: "MEMBER", status: "ACTIVE" },
          { orgId: org.id, userId: users.viewer.id, role: "MEMBER", status: "ACTIVE" },
          { orgId: org.id, userId: users.blocked.id, role: "MEMBER", status: "ACTIVE" },
          { orgId: org.id, userId: users.invitee.id, role: "MEMBER", status: "ACTIVE" },
          { orgId: org.id, userId: users.deactivated.id, role: "MEMBER", status: "DEACTIVATED" },
        ],
      });

      await prisma.teamMember.createMany({
        data: [
          { orgId: org.id, teamId: editorTeam.id, userId: users.editor.id, role: "MEMBER" },
          { orgId: org.id, teamId: viewerTeam.id, userId: users.viewer.id, role: "MEMBER" },
          { orgId: org.id, teamId: editorTeam.id, userId: users.deactivated.id, role: "MEMBER" },
        ],
      });

      const project = await prisma.project.create({
        data: {
          orgId: org.id,
          ownerId: users.admin.id,
          primaryTeamId: editorTeam.id,
          name: `E2E Collaboration Project ${now}`,
        },
      });
      projectId = project.id;

      await prisma.projectMember.create({
        data: {
          orgId: org.id,
          projectId: project.id,
          userId: users.admin.id,
          role: "PROJECT_ADMIN",
        },
      });

      await prisma.projectTeam.createMany({
        data: [
          { orgId: org.id, projectId: project.id, teamId: editorTeam.id, role: "EDITOR" },
          { orgId: org.id, projectId: project.id, teamId: viewerTeam.id, role: "VIEWER" },
        ],
      });

      const node = await prisma.node.create({
        data: {
          orgId: org.id,
          projectId: project.id,
          teamId: editorTeam.id,
          ownerId: users.editor.id,
          title: `E2E Collaboration Task ${now}`,
          description: "Initial task body",
        },
      });

      const adminApi = await apiFor(users.admin);
      const editorApi = await apiFor(users.editor);
      const viewerApi = await apiFor(users.viewer);
      const blockedApi = await apiFor(users.blocked);
      const inviteeApi = await apiFor(users.invitee);
      const deactivatedApi = await apiFor(users.deactivated);
      const externalApi = await apiFor(users.external);
      apiContexts.push(adminApi, editorApi, viewerApi, blockedApi, inviteeApi, deactivatedApi, externalApi);

      await expectStatus(await adminApi.get(`/api/projects/${project.id}/graph`), 200);
      await expectStatus(await editorApi.get(`/api/projects/${project.id}/graph`), 200);
      await expectStatus(await viewerApi.get(`/api/projects/${project.id}/graph`), 200);

      await expectStatus(await blockedApi.get(`/api/projects/${project.id}/graph`), 403);
      await expectStatus(await deactivatedApi.get(`/api/projects/${project.id}/graph`), 403);
      await expectStatus(await externalApi.get(`/api/projects/${project.id}/graph`), 403);

      const pagePatch = await editorApi.patch(`/api/nodes/${node.id}/page`, {
        data: { contentMarkdown: `Updated by editor for @${users.viewer.name}` },
      });
      await expectStatus(pagePatch, 200);

      await expectStatus(await viewerApi.get(`/api/nodes/${node.id}/page`), 200);
      await expectStatus(await viewerApi.patch(`/api/nodes/${node.id}/page`, {
        data: { contentMarkdown: "viewer must not edit" },
      }), 403);
      await expectStatus(await blockedApi.get(`/api/nodes/${node.id}/page`), 403);

      const commentCreate = await editorApi.post(`/api/nodes/${node.id}/comments`, {
        data: { body: `Editor comment mentioning @${users.viewer.name}` },
      });
      await expectStatus(commentCreate, 201);
      const { comment } = await commentCreate.json();

      await expectStatus(await viewerApi.get(`/api/nodes/${node.id}/comments`), 200);
      await expectStatus(await viewerApi.post(`/api/nodes/${node.id}/comments`, {
        data: { body: "viewer must not comment" },
      }), 403);
      await expectStatus(await viewerApi.patch(`/api/nodes/${node.id}/comments/${comment.id}`, {
        data: { body: "viewer must not edit someone else's comment" },
      }), 403);

      await expectStatus(await editorApi.post(`/api/projects/${project.id}/nodes`, {
        data: { title: "Editor-created task", description: "editor can create nodes" },
      }), 201);
      await expectStatus(await viewerApi.post(`/api/projects/${project.id}/nodes`, {
        data: { title: "Viewer-created task" },
      }), 403);
      await expectStatus(await viewerApi.patch(`/api/nodes/${node.id}`, {
        data: { title: "viewer must not update task" },
      }), 403);

      await expectStatus(await viewerApi.get(`/api/nodes/${node.id}/attachments`), 200);
      await expectStatus(await viewerApi.post(`/api/nodes/${node.id}/attachments`, {
        multipart: {
          file: {
            name: "viewer-upload.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("viewer must not upload"),
          },
        },
      }), 403);

      const canVerifyStorageUpload = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) || baseURL.startsWith("https://");
      if (canVerifyStorageUpload) {
        const upload = await editorApi.post(`/api/nodes/${node.id}/attachments`, {
          multipart: {
            file: {
              name: "collaboration-permission-check.txt",
              mimeType: "text/plain",
              buffer: Buffer.from("attachment permission check"),
            },
          },
        });
        await expectStatus(upload, 201);
        const { attachment } = await upload.json();
        await expectStatus(await adminApi.delete(`/api/nodes/${node.id}/attachments/${attachment.id}`), 200);
      }

      await expectStatus(await viewerApi.post(`/api/projects/${project.id}/teams`, {
        data: { teamId: spareTeam.id, role: "VIEWER" },
      }), 403);
      await expectStatus(await adminApi.post(`/api/projects/${project.id}/teams`, {
        data: { teamId: spareTeam.id, role: "VIEWER" },
      }), 200);

      const invite = await adminApi.post(`/api/projects/${project.id}/invites`, {
        data: { email: users.invitee.email, role: "VIEWER" },
      });
      await expectStatus(invite, 200);
      const inviteBody = await invite.json();

      await expectStatus(await inviteeApi.patch(`/api/projects/${project.id}/invites/${inviteBody.id}/respond`, {
        data: { accept: true },
      }), 200);
      await expectStatus(await inviteeApi.get(`/api/projects/${project.id}/graph`), 200);
      await expectStatus(await inviteeApi.post(`/api/nodes/${node.id}/comments`, {
        data: { body: "invitee accepted as viewer must not edit" },
      }), 403);
    } finally {
      for (const api of apiContexts) {
        await api.dispose();
      }
      if (orgId) {
        await prisma.organization.delete({ where: { id: orgId } }).catch(() => null);
      } else if (projectId) {
        await prisma.project.delete({ where: { id: projectId } }).catch(() => null);
      }
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => null);
      await prisma.$disconnect();
    }
  });
});
