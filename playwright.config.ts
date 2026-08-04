import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  outputDir: "test-results",
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  expect: {
    timeout: 15000,
  },
  use: {
    baseURL: "http://127.0.0.1:3200",
    locale: "es-ES",
    extraHTTPHeaders: {
      "Accept-Language": "es-ES,es;q=0.9",
    },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  webServer: {
    command: "exec ./node_modules/.bin/next dev -H 127.0.0.1 -p 3200",
    url: "http://127.0.0.1:3200/login",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      ...process.env,
      AUTH_DEMO_MODE: "true",
      NEXT_PUBLIC_AUTH_DEMO_MODE: "true",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3200",
      NEXT_DIST_DIR: ".next-playwright",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "playwright-test-secret-min-32-chars!!",
      DEMO_EMAIL: "demo@normaflow.io",
      DEMO_PASSWORD: "NormaFlow2025!",
      DEMO_NAME: "Ana García",
      CUSTOMER_EMAIL: "cliente@normaflow.io",
      CUSTOMER_PASSWORD: "NormaFlow2025!",
      CUSTOMER_NAME: "Admin Cliente",
    },
  },
});
