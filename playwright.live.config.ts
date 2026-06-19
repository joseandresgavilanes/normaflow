import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

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
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "live-chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- -p 3100",
    url: "http://127.0.0.1:3100/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      AUTH_DEMO_MODE: "false",
      NEXT_PUBLIC_AUTH_DEMO_MODE: "false",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
    },
  },
});
