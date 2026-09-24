/**
 * Settings shared by playwright.config.ts (which starts the app with them) and
 * the test helpers (which talk to the same database and mail sink).
 */

export const APP_PORT = Number(process.env.E2E_APP_PORT ?? 3217)
export const APP_URL = `http://localhost:${APP_PORT}`

export const MAIL_SINK_PORT = Number(process.env.MAIL_SINK_PORT ?? 4025)
export const MAIL_SINK_URL = `http://localhost:${MAIL_SINK_PORT}`

/** Must end in `_e2e` — prepare-db.mjs wipes it and refuses any other name. */
export const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://postgres:localdev@localhost:55432/football_prediction_e2e"

/** The one account granted the host role, via SITE_ADMIN_EMAILS on the server. */
export const HOST_EMAIL = "host@e2e.test"

export const PASSWORD = "password123"

/**
 * The server's whole environment. Every variable the app reads is set here —
 * even to "" — because Next only fills *unset* variables from `.env.local`, and
 * a developer's real Resend or football-data.org key must never leak into a
 * test run.
 */
export const APP_ENV: Record<string, string> = {
  DATABASE_URL,
  AUTH_SECRET: "e2e-auth-secret-not-for-production-use",
  NEXTAUTH_SECRET: "e2e-auth-secret-not-for-production-use",
  AUTH_URL: APP_URL,
  AUTH_TRUST_HOST: "true",
  SITE_ADMIN_EMAILS: HOST_EMAIL,
  RESEND_API_KEY: "e2e-resend-key",
  RESEND_API_URL: MAIL_SINK_URL,
  EMAIL_FROM: "Scorers <noreply@e2e.test>",
  FOOTBALL_DATA_API_KEY: "",
  CRON_SECRET: "e2e-cron-secret",
}
