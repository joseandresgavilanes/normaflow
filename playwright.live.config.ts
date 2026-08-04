import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { getLiveTestEnvironment } from "./tests-live/test-environment";

loadEnvConfig(process.cwd());
const testEnv = getLiveTestEnvironment();
// Prisma instances created by global setup and tests must target the same
// explicitly configured testing database as the application web server.
// Preserve the normal targets so child workers can re-run the isolation guard
// after DATABASE_URL is replaced with TEST_DATABASE_URL.
if (!process.env.NORMAFLOW_NORMAL_DATABASE_URL && process.env.DATABASE_URL) process.env.NORMAFLOW_NORMAL_DATABASE_URL = process.env.DATABASE_URL;
if (!process.env.NORMAFLOW_NORMAL_DIRECT_URL && process.env.DIRECT_URL) process.env.NORMAFLOW_NORMAL_DIRECT_URL = process.env.DIRECT_URL;
if (!process.env.NORMAFLOW_NORMAL_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) process.env.NORMAFLOW_NORMAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
process.env.DATABASE_URL = testEnv.databaseUrl;
process.env.DIRECT_URL = testEnv.directUrl;
process.env.NEXT_PUBLIC_SUPABASE_URL = testEnv.supabaseUrl;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = testEnv.supabaseAnonKey;
process.env.SUPABASE_SERVICE_ROLE_KEY = testEnv.supabaseServiceRoleKey;

export default defineConfig({
  testDir: "./tests-live",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 45_000,
  outputDir: "test-results-live",
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report-live", open: "never" }]],
  globalSetup: "./tests-live/global-setup.ts",
  globalTeardown: "./tests-live/global-teardown.ts",
  use: {
    baseURL: "http://127.0.0.1:3300",
    locale: "es-EC",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "live-chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- -p 3300",
    url: "http://127.0.0.1:3300/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      DATABASE_URL: testEnv.databaseUrl,
      DIRECT_URL: testEnv.directUrl,
      NEXT_PUBLIC_SUPABASE_URL: testEnv.supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: testEnv.supabaseAnonKey,
      SUPABASE_SERVICE_ROLE_KEY: testEnv.supabaseServiceRoleKey,
      AUTH_DEMO_MODE: "false",
      NEXT_PUBLIC_AUTH_DEMO_MODE: "false",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3300",
      NEXT_DIST_DIR: ".next-playwright-live",
    },
  },
});
