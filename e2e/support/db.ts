/**
 * Direct database access for arranging E2E scenarios — creating the league,
 * fixtures and rival players a journey needs, and moving the clock by editing
 * kickoff times. The journeys themselves always go through the UI or HTTP API.
 *
 * Plain SQL via `pg` rather than the generated Prisma client, which uses
 * `import.meta` and can't load under Playwright's CommonJS transform. Table and
 * column names are the Prisma model and field names (no @@map in the schema).
 *
 * Every helper creates uniquely-named rows, so specs never share state and can
 * run in parallel against one database.
 */
import { randomBytes, randomUUID } from "node:crypto"
import bcrypt from "bcryptjs"
import pg from "pg"
import { DATABASE_URL, HOST_EMAIL, PASSWORD } from "../env"

// Prisma keeps DateTimes as UTC in `timestamp without time zone` columns, but pg
// serialises a Date in the machine's local zone and Postgres drops the offset —
// so on a BST laptop every time written here would land an hour out. Read and
// write those columns as UTC, as Prisma does.
pg.defaults.parseInputDatesAsUTC = true
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (value) => new Date(`${value}Z`))

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4 })

// Cost 4 keeps setup fast; bcrypt.compare in the app accepts any cost.
const passwordHash = bcrypt.hashSync(PASSWORD, 4)

/** A short random tag to keep names, emails and codes unique per test. */
export function uniqueTag(): string {
  return randomBytes(4).toString("hex")
}

/** Same 6-char format as lib/inviteCode.ts. */
function inviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from(randomBytes(6), (b) => chars[b % chars.length]).join("")
}

export type TestUser = { id: string; email: string; displayName: string; apiKey: string }

export async function createUser(
  opts: { displayName?: string; email?: string; verified?: boolean; isBot?: boolean } = {},
): Promise<TestUser> {
  const tag = uniqueTag()
  const user = {
    id: randomUUID(),
    email: opts.email ?? `player-${tag}@e2e.test`,
    displayName: opts.displayName ?? `Player ${tag}`,
    apiKey: randomUUID(),
  }
  await pool.query(
    `INSERT INTO "User" (id, email, "passwordHash", "displayName", "isBot", "apiKey", "emailVerifiedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      user.id,
      user.email,
      passwordHash,
      user.displayName,
      opts.isBot ?? false,
      user.apiKey,
      opts.verified === false ? null : new Date(),
    ],
  )
  return user
}

/**
 * The site host. Host status is re-synced from SITE_ADMIN_EMAILS at every
 * login, so this is only the account — the server env grants the role.
 */
export async function ensureHost(): Promise<TestUser> {
  const existing = await pool.query<TestUser>(
    `SELECT id, email, "displayName", "apiKey" FROM "User" WHERE email = $1`,
    [HOST_EMAIL],
  )
  if (existing.rows[0]) return existing.rows[0]
  try {
    return await createUser({ email: HOST_EMAIL, displayName: "Host" })
  } catch {
    // Another worker created it first.
    const again = await pool.query<TestUser>(
      `SELECT id, email, "displayName", "apiKey" FROM "User" WHERE email = $1`,
      [HOST_EMAIL],
    )
    return again.rows[0]
  }
}

export type TestFixture = {
  id: string
  round: string
  homeTeam: string
  awayTeam: string
  kickoffTime: Date
}

export type TestLeague = {
  competition: { id: string; name: string }
  league: { id: string; name: string; inviteCode: string }
  /** One gameweek, all kicking off in the future and open for picks. */
  fixtures: TestFixture[]
}

/**
 * A competition with one open gameweek, and a league subscribed to it. Team
 * names carry the tag so rows can be found unambiguously on shared pages like
 * the host results queue.
 */
export async function createLeague(opts: { fixtureCount?: number } = {}): Promise<TestLeague> {
  const tag = uniqueTag()
  const competition = { id: randomUUID(), name: `E2E Cup ${tag}` }
  await pool.query(`INSERT INTO "Competition" (id, name) VALUES ($1, $2)`, [
    competition.id,
    competition.name,
  ])

  const league = { id: randomUUID(), name: `League ${tag}`, inviteCode: inviteCode() }
  await pool.query(
    `INSERT INTO "League" (id, name, "competitionId", "inviteCode") VALUES ($1, $2, $3, $4)`,
    [league.id, league.name, competition.id, league.inviteCode],
  )

  const teams = ["Rovers", "United", "Athletic", "Wanderers", "City", "Albion"]
  const fixtures: TestFixture[] = []
  for (let i = 0; i < (opts.fixtureCount ?? 2); i++) {
    const fixture = {
      id: randomUUID(),
      round: "Gameweek 1",
      homeTeam: `${teams[(2 * i) % teams.length]} ${tag}`,
      awayTeam: `${teams[(2 * i + 1) % teams.length]} ${tag}`,
      // Days out, so nothing locks mid-test; staggered so order is stable.
      kickoffTime: new Date(Date.now() + (2 + i) * 24 * 60 * 60 * 1000),
    }
    await pool.query(
      `INSERT INTO "Fixture" (id, "competitionId", round, "homeTeam", "awayTeam", "kickoffTime")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [fixture.id, competition.id, fixture.round, fixture.homeTeam, fixture.awayTeam, fixture.kickoffTime],
    )
    fixtures.push(fixture)
  }

  return { competition, league, fixtures }
}

export async function addMember(
  userId: string,
  leagueId: string,
  role: "MEMBER" | "COMMISSIONER" = "MEMBER",
): Promise<void> {
  await pool.query(
    `INSERT INTO "LeagueMembership" (id, "userId", "leagueId", role) VALUES ($1, $2, $3, $4)`,
    [randomUUID(), userId, leagueId, role],
  )
}

export async function addPrediction(
  userId: string,
  fixtureId: string,
  home: number,
  away: number,
): Promise<void> {
  await pool.query(
    `INSERT INTO "Prediction" (id, "userId", "fixtureId", "predictedHomeScore", "predictedAwayScore", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [randomUUID(), userId, fixtureId, home, away, new Date()],
  )
}

/**
 * Time travel: move a fixture's kickoff so the app sees it as past (or future).
 * Status is left alone — moving it on is the app's job.
 */
export async function setKickoff(fixtureId: string, kickoffTime: Date): Promise<void> {
  await pool.query(`UPDATE "Fixture" SET "kickoffTime" = $2 WHERE id = $1`, [fixtureId, kickoffTime])
}

export async function getPrediction(userId: string, fixtureId: string) {
  const { rows } = await pool.query<{
    predictedHomeScore: number
    predictedAwayScore: number
    isBanker: boolean
    pointsAwarded: number | null
    submittedVia: string
  }>(
    `SELECT "predictedHomeScore", "predictedAwayScore", "isBanker", "pointsAwarded", "submittedVia"
     FROM "Prediction" WHERE "userId" = $1 AND "fixtureId" = $2`,
    [userId, fixtureId],
  )
  return rows[0] ?? null
}

export async function findUserByEmail(email: string) {
  const { rows } = await pool.query<{ id: string; emailVerifiedAt: Date | null }>(
    `SELECT id, "emailVerifiedAt" FROM "User" WHERE email = $1`,
    [email],
  )
  return rows[0] ?? null
}

export async function membershipsOf(userId: string): Promise<string[]> {
  const { rows } = await pool.query<{ leagueId: string }>(
    `SELECT "leagueId" FROM "LeagueMembership" WHERE "userId" = $1`,
    [userId],
  )
  return rows.map((r) => r.leagueId)
}
