import { defineConfig, devices } from "@playwright/test"
import { APP_ENV, APP_PORT, APP_URL, MAIL_SINK_PORT, MAIL_SINK_URL } from "./e2e/env"

/**
 * End-to-end tests: a real browser against a production build (`next start`)
 * backed by a real Postgres, with outgoing email captured by e2e/mail-sink.mjs.
 * See docs/development.md#end-to-end-tests.
 *
 * The server is always started fresh (never reused) because prepare-db.mjs
 * resets the database as part of starting it. Set E2E_SKIP_BUILD=1 to reuse
 * the last `next build` when only the tests changed.
 */
const build = process.env.E2E_SKIP_BUILD ? "" : "npx next build && "

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: APP_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Dates on the page are formatted in en-GB by the server; keep the browser
    // consistent so nothing depends on the machine running the suite.
    locale: "en-GB",
    timezoneId: "Europe/London",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/mail-sink.mjs",
      url: `${MAIL_SINK_URL}/health`,
      env: { MAIL_SINK_PORT: String(MAIL_SINK_PORT) },
      reuseExistingServer: false,
    },
    {
      command: `node e2e/prepare-db.mjs && ${build}npx next start -p ${APP_PORT}`,
      url: `${APP_URL}/login`,
      env: APP_ENV,
      timeout: 300_000,
      reuseExistingServer: false,
      stdout: "pipe",
    },
  ],
})
