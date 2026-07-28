import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: externalBaseUrl || "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run dev",
        url: "http://127.0.0.1:3000/admin/login",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          DATABASE_URL:
            process.env.E2E_DATABASE_URL ||
            "postgresql://test:test@127.0.0.1:65432/test",
          SESSION_SECRET:
            process.env.SESSION_SECRET ||
            "e2e-session-secret-with-at-least-32-characters",
          RATE_LIMIT_HASH_SECRET:
            process.env.RATE_LIMIT_HASH_SECRET ||
            "e2e-rate-limit-secret-with-at-least-32-characters",
          NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
          NEXT_PUBLIC_GA_MEASUREMENT_ID: "",
          NEXT_PUBLIC_CLARITY_PROJECT_ID: "",
        },
      },
});
