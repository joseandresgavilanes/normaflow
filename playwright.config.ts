import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
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
    command: "npm run dev -- -H 127.0.0.1 -p 3200",
    url: "http://127.0.0.1:3200/login",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      ...process.env,
      AUTH_DEMO_MODE: "true",
      NEXT_PUBLIC_AUTH_DEMO_MODE: "true",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3200",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "playwright-test-secret-min-32-chars!!",
    },
  },
});
