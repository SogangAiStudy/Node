# Current State

Date: 2026-04-03
Repo: `SogangAiStudy/Node`
Branch checked out locally: `main`

## What was changed

- Added explicit Google OAuth endpoints in `auth.config.ts`:
  - `authorization.url = "https://accounts.google.com/o/oauth2/v2/auth"`
  - `token = "https://oauth2.googleapis.com/token"`
  - `userinfo = "https://openidconnect.googleapis.com/v1/userinfo"`

## GitHub state

- PR merged: `#12`
- PR URL: `https://github.com/SogangAiStudy/Node/pull/12`
- Merge commit: `53218c822b3bf57dfd808af2ffac30328e07161a`

## Production verification

- The real login flow is a server action on `POST /login`, not a direct browser GET to `/api/auth/signin/google`.
- Verified on production:
  - `POST https://node-ruddy-tau.vercel.app/login`
  - result: `303` redirect to Google OAuth
  - callback URL in redirect: `https://node-ruddy-tau.vercel.app/api/auth/callback/google`

## Important conclusion

- Initial sign-in bootstrap is working now.
- If login still fails in the browser, the likely failure point is after Google redirects back:
  - Google OAuth config mismatch
  - missing/incorrect Vercel env vars
  - Prisma/database error on callback
  - missing auth tables in production DB

## Required production values to verify

- `AUTH_URL=https://node-ruddy-tau.vercel.app`
- `AUTH_SECRET=<set in Vercel>`
- `GOOGLE_CLIENT_ID=<set in Vercel>`
- `GOOGLE_CLIENT_SECRET=<set in Vercel>`
- `DATABASE_URL=<set in Vercel>`
- `DIRECT_URL=<set in Vercel>`

## Google OAuth settings to verify

- Authorized redirect URI:
  - `https://node-ruddy-tau.vercel.app/api/auth/callback/google`
- Authorized redirect URI:
  - `http://localhost:3000/api/auth/callback/google`
- Authorized JavaScript origin:
  - `https://node-ruddy-tau.vercel.app`
- Authorized JavaScript origin:
  - `http://localhost:3000`

## Database tables expected by auth

- `users`
- `accounts`
- `sessions`
- `verification_tokens`

## Next debugging step

- Reproduce the exact error after Google redirects back to the app.
- Check Vercel production logs for `/api/auth/callback/google`.
