# Google OAuth Quickstart

This project already ships with a ready-to-use Google OAuth setup via **NextAuth.js**. Follow the steps below to reuse the configuration in this repo or to port it into another Next.js project without digging through the codebase.

## 1) Create Google OAuth credentials
1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** (type: **Web application**).
3. Add the following **Authorized redirect URI** (adjust host/port for your environment):
   - `http://localhost:3000/api/auth/callback/google`
   - For deployed environments, use `${NEXTAUTH_URL}/api/auth/callback/google`.
4. Copy the generated **Client ID** and **Client Secret**.

## 2) Configure environment variables
Set the required variables in `.env`:

```env
NEXTAUTH_SECRET="generate-with-openssl-or-powershell"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

- `NEXTAUTH_SECRET` secures JWT/session encryption. Generate with:
  ```bash
  openssl rand -base64 32
  ```
- `NEXTAUTH_URL` must be the public URL of your app (include `http://localhost:3000` for local dev).
- The Google variables must match the credentials you created in step 1.

## 3) Provider configuration (already set up)
Google is registered in `auth.config.ts` using `next-auth/providers/google`:

```ts
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/projects") || nextUrl.pathname === "/";
      const isOnAuthPage = nextUrl.pathname.startsWith("/login");

      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false;
      } else if (isLoggedIn && isOnAuthPage) {
        return Response.redirect(new URL("/", nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
```

The provider uses the env variables directly, so **no additional code changes** are needed after setting the env file.

## 4) NextAuth wiring
- Core handler and helpers live in [`auth.ts`](../auth.ts). It applies the Prisma adapter and re-exports `signIn`, `signOut`, and `auth` utilities.
- The API route at [`app/api/auth/[...nextauth]/route.ts`](../app/api/auth/%5B...nextauth%5D/route.ts) wires the NextAuth handlers to `GET` and `POST` requests.
- The custom sign-in page is located at `/login` (see `pages.signIn` above).

If you copy these files to another project, adjust import aliases (e.g., `@/lib/db/prisma`) and your Prisma adapter configuration as needed.

## 5) Use in components
Trigger Google login or logout from any client component:

```tsx
"use client";
import { signIn, signOut } from "@/auth";

export function GoogleButtons() {
  return (
    <div className="flex gap-2">
      <button onClick={() => signIn("google")}>Sign in with Google</button>
      <button onClick={() => signOut()}>Sign out</button>
    </div>
  );
}
```

## 6) Run locally
```bash
npm install
npm run dev
```
Visit `http://localhost:3000/login` and click **Continue with Google**. If the env vars and redirect URI are correct, the OAuth flow will complete and your user will be created in the database.
