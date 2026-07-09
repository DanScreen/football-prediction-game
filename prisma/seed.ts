import "dotenv/config"
import bcrypt from "bcryptjs"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient, FixtureStatus, ResultSource, SubmitVia } from "../app/generated/prisma/client"
import { scoreOnePrediction } from "../lib/scoring"
import { COMPETITIONS } from "../app/leagues/data"

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const hash = await bcrypt.hash("password123", 10)

  // ── 1. Competitions (platform-owned, subscribed to by leagues) ─────────────
  for (const c of COMPETITIONS) {
    await prisma.competition.upsert({
      where: { name: c.name },
      update: { code: c.code, flag: c.flag },
      create: { name: c.name, code: c.code, flag: c.flag },
    })
  }
  const premierLeague = await prisma.competition.findUniqueOrThrow({
    where: { name: "Premier League" },
  })
  console.log(`✓ Competitions (${COMPETITIONS.map((c) => c.name).join(", ")})`)

  // ── 2. Users ───────────────────────────────────────────────────────────────
  // host is seeded (site admin) but not referenced further below
  const [, commissioner, alice, bob, robo] = await Promise.all([
    prisma.user.upsert({
      where: { email: "host@football.test" },
      update: { isSiteAdmin: true },
      create: {
        email: "host@football.test",
        passwordHash: hash,
        displayName: "Host",
        isSiteAdmin: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "commissioner@football.test" },
      update: {},
      create: { email: "commissioner@football.test", passwordHash: hash, displayName: "Commissioner" },
    }),
    prisma.user.upsert({
      where: { email: "alice@football.test" },
      update: {},
      create: { email: "alice@football.test", passwordHash: hash, displayName: "Alice" },
    }),
    prisma.user.upsert({
      where: { email: "bob@football.test" },
      update: {},
      create: { email: "bob@football.test", passwordHash: hash, displayName: "Bob" },
    }),
    prisma.user.upsert({
      where: { email: "robo@football.test" },
      update: {},
      create: { email: "robo@football.test", passwordHash: hash, displayName: "Robo", isBot: true },
    }),
  ])
  console.log("✓ Users (host, commissioner, alice, bob, robo)")

  // ── 3. League (subscribes to the Premier League competition) ───────────────
  const league = await prisma.league.upsert({
    where: { inviteCode: "GOAAALLL" },
    update: {},
    create: {
      name: "Test League",
      competitionId: premierLeague.id,
      inviteCode: "GOAAALLL",
      grandSlamEnabled: false,
      grandSlamPoints: 3,
    },
  })
  console.log(`✓ League "${league.name}" (code: ${league.inviteCode})`)

  // ── 4. Memberships ────────────────────────────────────────────────────────
  await Promise.all([
    prisma.leagueMembership.upsert({
      where: { userId_leagueId: { userId: commissioner.id, leagueId: league.id } },
      update: {},
      create: { userId: commissioner.id, leagueId: league.id, role: "COMMISSIONER" },
    }),
    prisma.leagueMembership.upsert({
      where: { userId_leagueId: { userId: alice.id, leagueId: league.id } },
      update: {},
      create: { userId: alice.id, leagueId: league.id, role: "MEMBER" },
    }),
    prisma.leagueMembership.upsert({
      where: { userId_leagueId: { userId: bob.id, leagueId: league.id } },
      update: {},
      create: { userId: bob.id, leagueId: league.id, role: "MEMBER" },
    }),
    prisma.leagueMembership.upsert({
      where: { userId_leagueId: { userId: robo.id, leagueId: league.id } },
      update: {},
      create: { userId: robo.id, leagueId: league.id, role: "MEMBER" },
    }),
  ])
  console.log("✓ Memberships")

  // ── 5. Canonical fixtures (owned by the competition, shared by all leagues) ─
  const existingCount = await prisma.fixture.count({
    where: { competitionId: premierLeague.id },
  })
  if (existingCount > 0) {
    console.log(`⏭  Skipping fixtures — ${existingCount} already exist for this competition`)
    return
  }

  // Completed round — Matchweek 38 (June 8, 2026)
  const mw38Data = [
    { homeTeam: "Arsenal",         awayTeam: "Chelsea",          kickoff: "2026-06-08T15:00:00Z", h: 2, a: 1 },
    { homeTeam: "Manchester City", awayTeam: "Liverpool",         kickoff: "2026-06-08T17:30:00Z", h: 1, a: 1 },
    { homeTeam: "Tottenham",       awayTeam: "Manchester United", kickoff: "2026-06-08T20:00:00Z", h: 0, a: 2 },
  ]

  const mw38 = await Promise.all(
    mw38Data.map((d) =>
      prisma.fixture.create({
        data: {
          competitionId: premierLeague.id,
          round: "Matchweek 38",
          homeTeam: d.homeTeam,
          awayTeam: d.awayTeam,
          kickoffTime: new Date(d.kickoff),
          status: FixtureStatus.COMPLETED,
          actualHomeScore: d.h,
          actualAwayScore: d.a,
          resultSource: ResultSource.MANUAL,
        },
      }),
    ),
  )
  console.log("✓ Completed fixtures — Matchweek 38")

  // Upcoming round — Matchweek 39 (June 22-23, 2026)
  const mw39Data = [
    { homeTeam: "Arsenal",         awayTeam: "Manchester United", kickoff: "2026-06-22T15:00:00Z" },
    { homeTeam: "Chelsea",         awayTeam: "Liverpool",          kickoff: "2026-06-22T17:30:00Z" },
    { homeTeam: "Manchester City", awayTeam: "Tottenham",          kickoff: "2026-06-23T14:00:00Z" },
  ]

  await prisma.fixture.createMany({
    data: mw39Data.map((d) => ({
      competitionId: premierLeague.id,
      round: "Matchweek 39",
      homeTeam: d.homeTeam,
      awayTeam: d.awayTeam,
      kickoffTime: new Date(d.kickoff),
      status: FixtureStatus.SCHEDULED,
    })),
  })
  console.log("✓ Upcoming fixtures  — Matchweek 39")

  // ── 6. Predictions for completed fixtures ──────────────────────────────
  //
  // Results:  Arsenal 2-1 Chelsea | Man City 1-1 Liverpool | Spurs 0-2 Man Utd
  //
  // Alice:    2-1 (exact!)  | 0-0 (draw, same diff)  | 0-3 (correct result)   → 3 + 1.5 + 1 = 5.5
  // Bob:      1-0 (HW, +1)  | 2-1 (wrong: HW vs D)   | 1-2 (AW, diff -1≠-2)  → 1.5 + 0 + 1 = 2.5
  // Robo:     1-1 (wrong)   | 2-2 (draw, same diff)  | 0-1 (AW, diff -1≠-2)  → 0 + 1.5 + 1 = 2.5

  const allPicks: Array<{ userId: string; fixtureIdx: number; pH: number; pA: number }> = [
    { userId: alice.id, fixtureIdx: 0, pH: 2, pA: 1 },
    { userId: alice.id, fixtureIdx: 1, pH: 0, pA: 0 },
    { userId: alice.id, fixtureIdx: 2, pH: 0, pA: 3 },
    { userId: bob.id,   fixtureIdx: 0, pH: 1, pA: 0 },
    { userId: bob.id,   fixtureIdx: 1, pH: 2, pA: 1 },
    { userId: bob.id,   fixtureIdx: 2, pH: 1, pA: 2 },
    { userId: robo.id,  fixtureIdx: 0, pH: 1, pA: 1 },
    { userId: robo.id,  fixtureIdx: 1, pH: 2, pA: 2 },
    { userId: robo.id,  fixtureIdx: 2, pH: 0, pA: 1 },
  ]

  for (const { userId, fixtureIdx, pH, pA } of allPicks) {
    const f = mw38[fixtureIdx]
    await prisma.prediction.create({
      data: {
        userId,
        fixtureId: f.id,
        predictedHomeScore: pH,
        predictedAwayScore: pA,
        pointsAwarded: scoreOnePrediction(pH, pA, f.actualHomeScore!, f.actualAwayScore!),
        submittedVia: SubmitVia.WEB,
      },
    })
  }
  console.log("✓ Predictions with points awarded")

  console.log("\nLeaderboard preview (Matchweek 38):")
  console.log("  Alice  5.5 pts  (1 exact ⚽)")
  console.log("  Bob    2.5 pts")
  console.log("  Robo   2.5 pts  🤖")
  console.log("\nMatchweek 39 fixtures are open for predictions.")
  console.log("Host login: host@football.test (site admin)")
  console.log("Members: alice@football.test / bob@football.test / commissioner@football.test")
  console.log("Password: password123  |  League invite code: GOAAALLL")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
