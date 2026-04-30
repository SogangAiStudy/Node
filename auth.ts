import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  logger: {
    error(code, ...message) {
      console.error("[auth][logger][error]", code, ...message);
    },
    warn(code, ...message) {
      console.warn("[auth][logger][warn]", code, ...message);
    },
  },
  ...authConfig,
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        if (token.sub) {
          session.user.id = token.sub;
        } else if (session.user.email) {
          const dbUser = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
          });

          if (dbUser) {
            session.user.id = dbUser.id;
          }
        }
      }

      return session;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

      return token;
    },
    ...authConfig.callbacks,
  },
});
