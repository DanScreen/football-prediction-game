import "dotenv/config"
import bcrypt from "bcryptjs"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import {
  PrismaClient,
  FixtureStatus,
  ResultSource,
  SubmitVia,
} from "../app/generated/prisma/client"
import { scoreOnePrediction, awardedPoints, STREAK_TIERS } from "../lib/scoring"

/**
 * Demo data for App Store / Play Store screenshots.
 *
 * `prisma/seed.ts` is deliberately minimal — three players and one settled
 * round, which is right for development but shows an empty-looking game in a
 * store listing. This builds a season that has visibly been *played*: eight
 * players, four settled gameweeks so the form strip fills up, bankers, streak
 * bonuses, exact scores, a round whose results are proposed-but-unconfirmed so
 * the amber provisional state appears, and an open round the player is
 * part-way through.
 *
 * Run it against the local Docker Postgres only. It wipes the Premier League
 * competition's fixtures and every prediction on them first, so re-running it
 * is idempotent.
 *
 *   docker compose up -d
 *   DATABASE_URL="postgresql://postgres:localdev@localhost:55432/football_prediction_app" \
 *     npx tsx scripts/seed-store-demo.ts
 *
 * The screenshots themselves are captured by `scripts/capture-store-shots.mjs`.
 * See docs/store-release.md.
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

/** The account the screenshots are taken as. */
const HERO = { email: "alice@football.test", displayName: "Alice" }

const PLAYERS = [
  { email: "alice@football.test", displayName: "Alice", isBot: false },
  { email: "bob@football.test", displayName: "Bob", isBot: false },
  { email: "priya@football.test", displayName: "Priya", isBot: false },
  { email: "marcus@football.test", displayName: "Marcus", isBot: false },
  { email: "jo@football.test", displayName: "Jo", isBot: false },
  { email: "sam@football.test", displayName: "Sam", isBot: false },
  { email: "elena@football.test", displayName: "Elena", isBot: false },
  { email: "robo@football.test", displayName: "Robo", isBot: true },
]

const TEAMS = [
  ["Arsenal", "Chelsea"],
  ["Manchester City", "Liverpool"],
  ["Tottenham", "Manchester United"],
  ["Newcastle", "Aston Villa"],
  ["Brighton", "Everton"],
  ["West Ham", "Nottingham Forest"],
]

/** Deterministic PRNG, so a re-run produces the same listing screenshots. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

async function main() {
  const hash = await bcrypt.hash("password123", 10)

  const competition = await prisma.competition.findUniqueOrThrow({
    where: { name: "Premier League" },
  })

  const users = await Promise.all(
    PLAYERS.map((p) =>
      prisma.user.upsert({
        where: { email: p.email },
        update: { displayName: p.displayName, isBot: p.isBot },
        create: { ...p, passwordHash: hash },
      }),
    ),
  )
  const hero = users.find((u) => u.email === HERO.email)!

  const league = await prisma.league.upsert({
    where: { inviteCode: "GOAAALLL" },
    update: { name: "The Sunday League", competitionId: competition.id },
    create: {
      name: "The Sunday League",
      competitionId: competition.id,
      inviteCode: "GOAAALLL",
    },
  })

  // Drop anyone the base seed put in this league who is not part of the demo
  // cast — a stray zero-point member at the bottom of the table is the first
  // thing the eye lands on in a store screenshot.
  await prisma.leagueMembership.deleteMany({
    where: { leagueId: league.id, userId: { notIn: users.map((u) => u.id) } },
  })

  for (const u of users) {
    await prisma.leagueMembership.upsert({
      where: { userId_leagueId: { userId: u.id, leagueId: league.id } },
      update: {},
      create: {
        userId: u.id,
        leagueId: league.id,
        role: u.id === hero.id ? "COMMISSIONER" : "MEMBER",
      },
    })
  }

  // Clear the competition's fixtures and everything hanging off them, so the
  // script is safe to re-run while iterating on a screenshot.
  const oldFixtures = await prisma.fixture.findMany({
    where: { competitionId: competition.id },
    select: { id: true },
  })
  await prisma.prediction.deleteMany({
    where: { fixtureId: { in: oldFixtures.map((f) => f.id) } },
  })
  await prisma.bonusAward.deleteMany({ where: { leagueId: league.id } })
  await prisma.fixture.deleteMany({ where: { competitionId: competition.id } })

  const rand = rng(20260828)
  const now = Date.now()
  const DAY = 86_400_000

  // Four settled rounds, then one awaiting confirmation, then the open round.
  const rounds = [
    { round: "Matchweek 31", daysAgo: 28, state: "settled" as const },
    { round: "Matchweek 32", daysAgo: 21, state: "settled" as const },
    { round: "Matchweek 33", daysAgo: 14, state: "settled" as const },
    { round: "Matchweek 34", daysAgo: 7, state: "settled" as const },
    { round: "Matchweek 35", daysAgo: 1, state: "proposed" as const },
    { round: "Matchweek 36", daysAgo: -2, state: "open" as const },
    { round: "Matchweek 37", daysAgo: -9, state: "open" as const },
  ]

  for (const spec of rounds) {
    const base = now - spec.daysAgo * DAY
    const fixtures = []

    for (const [i, [home, away]] of TEAMS.entries()) {
      const kickoff = new Date(base + i * 2.5 * 3_600_000)
      const actualHome = Math.floor(rand() * 4)
      const actualAway = Math.floor(rand() * 3)

      fixtures.push(
        await prisma.fixture.create({
          data: {
            competitionId: competition.id,
            round: spec.round,
            homeTeam: home,
            awayTeam: away,
            kickoffTime: kickoff,
            status:
              spec.state === "settled"
                ? FixtureStatus.COMPLETED
                : spec.state === "proposed"
                  ? FixtureStatus.AWAITING_RESULT
                  : FixtureStatus.SCHEDULED,
            ...(spec.state === "settled"
              ? {
                  actualHomeScore: actualHome,
                  actualAwayScore: actualAway,
                  resultSource: ResultSource.MANUAL,
                }
              : {}),
            ...(spec.state === "proposed"
              ? { proposedHomeScore: actualHome, proposedAwayScore: actualAway }
              : {}),
          },
        }),
      )
    }

    if (spec.state === "open") {
      // The nearest open round is deliberately part-predicted: the round header
      // then shows both a chosen banker and an outstanding count, which is the
      // state the predictions screen is actually interesting in.
      if (spec.daysAgo === -2) {
        for (const [i, f] of fixtures.slice(0, 4).entries()) {
          await prisma.prediction.create({
            data: {
              userId: hero.id,
              fixtureId: f.id,
              predictedHomeScore: [2, 1, 3, 0][i],
              predictedAwayScore: [1, 1, 0, 2][i],
              isBanker: i === 0,
              submittedVia: SubmitVia.WEB,
            },
          })
        }
      }
      continue
    }

    // Everyone predicts every played fixture. The hero is given a good but not
    // perfect round so the screenshots show all four scoring tiers.
    for (const user of users) {
      const isHero = user.id === hero.id
      let correctResults = 0
      const bankerIndex = Math.floor(rand() * TEAMS.length)

      for (const [i, f] of fixtures.entries()) {
        const actualHome = f.actualHomeScore ?? f.proposedHomeScore ?? 0
        const actualAway = f.actualAwayScore ?? f.proposedAwayScore ?? 0

        // Bias the hero toward exact and close picks; everyone else drifts.
        const roll = rand()
        let pH: number
        let pA: number
        if (roll < (isHero ? 0.34 : 0.16)) {
          pH = actualHome
          pA = actualAway
        } else if (roll < (isHero ? 0.7 : 0.45)) {
          pH = Math.max(0, actualHome + (rand() < 0.5 ? 1 : 0))
          pA = Math.max(0, actualAway + (rand() < 0.5 ? 1 : 0))
        } else {
          pH = Math.floor(rand() * 4)
          pA = Math.floor(rand() * 3)
        }

        const base = scoreOnePrediction(pH, pA, actualHome, actualAway)
        if (base > 0) correctResults += 1
        const isBanker = i === bankerIndex

        await prisma.prediction.create({
          data: {
            userId: user.id,
            fixtureId: f.id,
            predictedHomeScore: pH,
            predictedAwayScore: pA,
            isBanker,
            // Only a settled round has confirmed points; the proposed round
            // must leave these null so it shows as provisional in the UI.
            pointsAwarded:
              spec.state === "settled" ? awardedPoints(base, isBanker) : null,
            submittedVia: user.isBot ? SubmitVia.API : SubmitVia.WEB,
          },
        })
      }

      if (spec.state !== "settled") continue

      const tier = [...STREAK_TIERS]
        .sort((a, b) => b.minCorrect - a.minCorrect)
        .find((t) => correctResults >= t.minCorrect)
      if (tier) {
        await prisma.bonusAward.upsert({
          where: {
            userId_leagueId_round: {
              userId: user.id,
              leagueId: league.id,
              round: spec.round,
            },
          },
          update: { points: tier.points },
          create: {
            userId: user.id,
            leagueId: league.id,
            round: spec.round,
            points: tier.points,
          },
        })
      }
    }
  }

  const counts = await prisma.fixture.groupBy({
    by: ["status"],
    where: { competitionId: competition.id },
    _count: true,
  })
  console.log("✓ Store demo data seeded")
  console.log(`  League: ${league.name} (${users.length} players)`)
  console.log(`  Fixtures: ${counts.map((c) => `${c.status}=${c._count}`).join(", ")}`)
  console.log(`  Sign in as ${HERO.email} / password123`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
