import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  ...authConfig,
  callbacks: {
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token }) {
      return token;
    },
    ...authConfig.callbacks,
  },
  events: {
    async createUser({ user }) {
      if (user.id) {
        try {
          // Auto-join the demo org
          await prisma.orgMember.create({
            data: {
              orgId: "demo-org-id",
              userId: user.id,
              role: "MEMBER",
              status: "ACTIVE",
            },
          });

          // Create initial inbox state
          await prisma.orgInboxState.create({
            data: {
              orgId: "demo-org-id",
              userId: user.id,
            },
          });

          console.log(`User ${user.id} auto-joined demo-org-id`);
        } catch (err) {
          console.error("Failed to auto-join demo organization:", err);
        }
      }
    },
  },
});
