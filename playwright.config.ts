import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

const port = Number(process.env.E2E_PORT || 3000);
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
const envFile = process.env.E2E_ENV_FILE || ".env.local";

if (process.env.E2E_ENV_FILE && fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, "$2");
  }
}

process.env.AUTH_SECRET ||= process.env.NEXTAUTH_SECRET;
if (!process.env.E2E_BASE_URL) {
  process.env.AUTH_URL = baseURL;
  process.env.NEXTAUTH_URL = baseURL;
  process.env.AUTH_TRUST_HOST = "true";
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `dotenv -e ${envFile} -- env AUTH_URL=${baseURL} NEXTAUTH_URL=${baseURL} AUTH_TRUST_HOST=true next dev --webpack --hostname 127.0.0.1 --port ${port}`,
        url: `${baseURL}/login`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
