# NextAuth + Prisma (App Router) Quickstart

**Goal:** Drop-in recipe to wire NextAuth.js with Prisma/PostgreSQL in an App Router project—no digging through docs required.

> We already ship this integration. Use the snippets below to copy the exact structure into another project.

---

## 0) Install and generate Prisma client
```bash
npm install next-auth @auth/prisma-adapter @prisma/client
npx prisma generate
```

> The schema needs the built-in NextAuth tables (see §4). If you change the schema, re-run `npx prisma generate`.

---

## 1) Environment variables
Add to `.env`:
```env
DATABASE_URL="postgresql://postgres:<PASSWORD>@localhost:5432/node_db?schema=public"
NEXTAUTH_SECRET="<random-32-byte>"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="<from Google console>"
GOOGLE_CLIENT_SECRET="<from Google console>"
```

- `NEXTAUTH_SECRET` can be generated with `openssl rand -base64 32` (or the PowerShell snippet in README).
- Swap Google credentials for any other provider credentials (GitHub, etc.).

---

## 2) Auth config with provider + route guard
`auth.config.ts` defines the provider and a minimal authorization callback that protects dashboard pages and redirects signed-in users away from `/login`.

```ts
// auth.config.ts
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/projects") || nextUrl.pathname === "/";
      const isOnAuthPage = nextUrl.pathname.startsWith("/login");

      if (isOnDashboard) {
        return isLoggedIn; // gate dashboard
      } else if (isLoggedIn && isOnAuthPage) {
        return Response.redirect(new URL("/", nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
```

Add middleware to apply the guard everywhere except API/static assets:
```ts
// middleware.ts
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
```

---

## 3) NextAuth + Prisma adapter wiring
`auth.ts` composes the Prisma adapter, JWT session strategy, and callback to attach `user.id` to the session.

```ts
// auth.ts
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
});
```

`lib/db/prisma.ts` shows the pool-based Prisma client (safe for hot reload in dev):
```ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const createPrismaClient = () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

---

## 4) Prisma schema (drop-in models)
Add the NextAuth tables to `prisma/schema.prisma` alongside your domain models. The important part is the `Account`, `Session`, and `VerificationToken` models and their relation to `User`.

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  createdAt     DateTime  @default(now())

  accounts Account[]
  sessions Session[]
  // ...your domain relations (projects, nodes, etc.)

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}
```

Run migrations/push to create the tables:
```bash
npx prisma migrate dev --name init_auth    # or: npx prisma db push
```

---

## 5) Client-side usage (SessionProvider + sign-in/out)
Wrap your app in `SessionProvider` and provide React Query/toast in one place:
```tsx
// components/providers.tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, refetchOnWindowFocus: false },
    },
  }));

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </SessionProvider>
  );
}
```

A minimal sign-in form using server actions (App Router):
```tsx
// app/login/page.tsx
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/" });
      }}
    >
      <Button type="submit">Sign in with Google</Button>
    </form>
  );
}
```

Sign-out can be handled similarly with `signOut()` from `@/auth`.

---

## 6) API route protection patterns
- **Route-level guard:** Use the `auth()` helper in server components/route handlers to enforce auth and read the session.
- **Middleware-level guard:** Already configured in `middleware.ts` to redirect anonymous users away from dashboard routes.
- **JWT payload:** `session.user.id` is populated from the JWT `sub`, so you can safely use it in API handlers without additional DB lookups.

Example server action / route handler:
```ts
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  await prisma.project.create({ data: { name: "Demo", members: { create: { userId: session.user.id } } } });
  return Response.json({ ok: true });
}
```

You now have a copy-pasteable NextAuth + Prisma stack ready for any App Router project.
