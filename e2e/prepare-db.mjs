// Gives the Playwright suite a clean database before the app starts: creates
// the E2E database if needed, wipes its schema, and applies every migration
// from scratch (so the suite also proves the migration history still builds a
// working schema). Test data is created by each spec — see e2e/support/db.ts.
//
// Refuses to touch anything whose name doesn't end in "_e2e", so a stray
// DATABASE_URL can never wipe the dev or production database.

import { execSync } from "node:child_process"
import pg from "pg"

const url = process.env.DATABASE_URL
if (!url) throw new Error("prepare-db: DATABASE_URL is not set")

const target = new URL(url)
const dbName = target.pathname.slice(1)
if (!dbName.endsWith("_e2e")) {
  throw new Error(`prepare-db: refusing to reset "${dbName}" — the E2E database name must end in _e2e`)
}

const admin = new URL(url)
admin.pathname = "/postgres"
const adminClient = new pg.Client({ connectionString: admin.toString() })
await adminClient.connect()
const { rowCount } = await adminClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName])
if (!rowCount) await adminClient.query(`CREATE DATABASE "${dbName}"`)
await adminClient.end()

const client = new pg.Client({ connectionString: url })
await client.connect()
await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;")
await client.end()

execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env })
console.log(`prepare-db: ${dbName} reset and migrated`)
