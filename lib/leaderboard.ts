import { prisma } from "@/lib/prisma"
import { scoreOnePrediction, BANKER_MULTIPLIER } from "@/lib/scoring"
import { provisionalPoints } from "@/lib/provisional"

export type PointsBreakdown = {
  /** Right result only (1 each). */
  result: number
  /** Right result, scoreline within one goal, not exact (1.5 each). */
  close: number
  /** Exact scoreline (3 each). */
  exact: number
  /** The *extra* points doubling produced — not the whole bankered fixture. */
  banker: number
  /** Streak bonuses, which sit outside a prediction's own points. */
  streak: number
}

export type LeaderboardEntry = {
  id: string
  displayName: string
  isBot: boolean
  /** Confirmed points (pointsAwarded + streak bonuses) — authoritative. */
  confirmedPoints: number
  /** Points from proposed-but-unconfirmed results. Display only. */
  provisionalPoints: number
  exactCount: number
  /**
   * Where the confirmed points came from. These five sum to `confirmedPoints`
   * exactly, so the row always adds up on screen.
   *
   * Derived from the *stored* `pointsAwarded` rather than recomputed from the
   * scoreline: the stored figure is what actually counts, so splitting it can't
   * drift away from the total the way a parallel recomputation could.
   */
  breakdown: PointsBreakdown
  /** Total streak-bonus points earned. Tiered 1-3, so a count would hide size. */
  streakPoints: number
  /** Rank by confirmed points (standings never move on provisional data). */
  rank: number
}

/**
 * Compute a league's standings from its members' predictions on the league's
 * competition fixtures. Shared by the leaderboard page and /api/v1/leaderboard.
 *
 * Pass `round` to score a single gameweek instead of the season. That filters
 * the predictions *and* the bonus awards, so a round table is the same
 * calculation over a smaller set rather than a second idea of what a point is
 * worth — the two could otherwise drift apart, and a round table that doesn't
 * sum to the overall one is worse than no round table.
 */
export async function computeLeaderboard(
  leagueId: string,
  options: { round?: string } = {},
): Promise<LeaderboardEntry[]> {
  const { round } = options
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { competitionId: true, memberships: { select: { userId: true } } },
  })
  if (!league) return []
  const memberIds = league.memberships.map((m) => m.userId)

  const [users, predictions, bonusAwards] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, displayName: true, isBot: true },
    }),
    prisma.prediction.findMany({
      where: {
        userId: { in: memberIds },
        fixture: { competitionId: league.competitionId, ...(round ? { round } : {}) },
      },
      select: {
        userId: true,
        pointsAwarded: true,
        predictedHomeScore: true,
        predictedAwayScore: true,
        // Needed so provisional points double for a banker, the way confirmed
        // points already do via the stored pointsAwarded.
        isBanker: true,
        fixture: {
          select: {
            status: true,
            actualHomeScore: true,
            actualAwayScore: true,
            proposedHomeScore: true,
            proposedAwayScore: true,
          },
        },
      },
    }),
    prisma.bonusAward.findMany({
      where: { leagueId, ...(round ? { round } : {}) },
      select: { userId: true, points: true },
    }),
  ])

  const bonusByUser = new Map<string, number>()
  for (const b of bonusAwards) {
    bonusByUser.set(b.userId, (bonusByUser.get(b.userId) ?? 0) + b.points)
  }

  const entries = users
    .map((user) => {
      const preds = predictions.filter((p) => p.userId === user.id)
      const bonus = bonusByUser.get(user.id) ?? 0

      const confirmedPoints =
        preds.reduce((sum, p) => sum + (p.pointsAwarded ?? 0), 0) + bonus

      const breakdown: PointsBreakdown = {
        result: 0,
        close: 0,
        exact: 0,
        banker: 0,
        streak: bonus,
      }
      for (const p of preds) {
        if (p.pointsAwarded === null) continue
        // Undo the multiplier to recover the base tier, then bank the extra
        // separately — so a bankered exact reads as 3 exact + 3 banker, not 6
        // in a bucket that claims to be "exact score" points.
        const base = p.isBanker ? p.pointsAwarded / BANKER_MULTIPLIER : p.pointsAwarded
        if (base === 3) breakdown.exact += base
        else if (base === 1.5) breakdown.close += base
        else if (base === 1) breakdown.result += base
        breakdown.banker += p.isBanker ? p.pointsAwarded - base : 0
      }

      const provisional = preds.reduce(
        (sum, p) => sum + (provisionalPoints(p, p.fixture) ?? 0),
        0,
      )

      const exactCount = preds.filter(
        (p) =>
          p.fixture.actualHomeScore !== null &&
          p.fixture.actualAwayScore !== null &&
          scoreOnePrediction(
            p.predictedHomeScore,
            p.predictedAwayScore,
            p.fixture.actualHomeScore,
            p.fixture.actualAwayScore,
          ) === 3,
      ).length

      return {
        id: user.id,
        displayName: user.displayName,
        isBot: user.isBot,
        confirmedPoints,
        provisionalPoints: provisional,
        exactCount,
        breakdown,
        streakPoints: bonus,
      }
    })
    .sort((a, b) => b.confirmedPoints - a.confirmedPoints)

  // Equal confirmed points share a rank
  const ranked: LeaderboardEntry[] = []
  entries.forEach((entry, i) => {
    const rank =
      i === 0
        ? 1
        : entries[i - 1].confirmedPoints === entry.confirmedPoints
          ? ranked[i - 1].rank
          : i + 1
    ranked.push({ ...entry, rank })
  })
  return ranked
}

/** How a player's last-5-rounds form cell is graded. */
export type FormTier = "strong" | "mixed" | "poor" | "none"

export type FormCell = {
  round: string
  tier: FormTier
  /** Confirmed points scored in that round. 0 when `tier` is "none". */
  scored: number
}

/**
 * Each member's form over the league competition's last five completed rounds,
 * oldest → newest, keyed by user id. Members with no scored picks still get a
 * full-length array of `"none"` cells, so every row's strip lines up.
 *
 * Extracted from the leaderboard page so `/api/mobile/v1/leaderboards` can send
 * the same strip to the native apps — two implementations of "what counts as
 * good form" would inevitably grade the same round differently.
 */
export async function computeLeagueForm(
  leagueId: string,
): Promise<{ rounds: string[]; byUser: Map<string, FormCell[]> }> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { competitionId: true, memberships: { select: { userId: true } } },
  })
  if (!league) return { rounds: [], byUser: new Map() }
  const memberIds = league.memberships.map((m) => m.userId)

  const [scoredPredictions, completedFixtures] = await Promise.all([
    prisma.prediction.findMany({
      where: {
        userId: { in: memberIds },
        fixture: { competitionId: league.competitionId },
        pointsAwarded: { not: null },
      },
      select: { userId: true, pointsAwarded: true, fixture: { select: { round: true } } },
    }),
    prisma.fixture.findMany({
      where: { competitionId: league.competitionId, status: "COMPLETED" },
      select: { round: true, kickoffTime: true },
    }),
  ])

  // A round's position in time is its *latest* kickoff, so a round that spans a
  // weekend doesn't sort ahead of one that finished after it.
  const roundMaxKickoff = new Map<string, Date>()
  for (const f of completedFixtures) {
    const existing = roundMaxKickoff.get(f.round)
    if (!existing || f.kickoffTime > existing) roundMaxKickoff.set(f.round, f.kickoffTime)
  }

  const rounds = [...roundMaxKickoff.entries()]
    .sort(([, a], [, b]) => b.getTime() - a.getTime())
    .slice(0, 5)
    .reverse()
    .map(([round]) => round)

  const statsByUser = new Map<string, Map<string, { scored: number; count: number }>>()
  for (const p of scoredPredictions) {
    let byRound = statsByUser.get(p.userId)
    if (!byRound) {
      byRound = new Map()
      statsByUser.set(p.userId, byRound)
    }
    const s = byRound.get(p.fixture.round) ?? { scored: 0, count: 0 }
    byRound.set(p.fixture.round, {
      scored: s.scored + (p.pointsAwarded ?? 0),
      count: s.count + 1,
    })
  }

  const byUser = new Map<string, FormCell[]>()
  for (const userId of memberIds) {
    const stats = statsByUser.get(userId)
    byUser.set(
      userId,
      rounds.map((round) => {
        const s = stats?.get(round)
        if (!s || s.count === 0) return { round, tier: "none" as const, scored: 0 }
        // Share of the maximum available (3 per pick), not a raw total, so a
        // round with more fixtures doesn't look like better form on its own.
        const pct = s.scored / (s.count * 3)
        const tier: FormTier = pct > 0.4 ? "strong" : pct > 0.2 ? "mixed" : "poor"
        return { round, tier, scored: s.scored }
      }),
    )
  }

  return { rounds, byUser }
}

/**
 * The league competition's rounds that have a table worth showing, newest
 * first. A round qualifies once its first fixture has kicked off: before that
 * every pick is still hidden and every score is zero, so an empty table would
 * only invite people to read a gameweek that has not happened.
 *
 * Ordered on each round's *latest* kickoff, the same rule the form strip and
 * the mobile Results tab use — a round that spans a weekend must not sort ahead
 * of one that finished after it.
 */
export async function listPlayedRounds(
  leagueId: string,
  now: Date = new Date(),
): Promise<string[]> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { competitionId: true },
  })
  if (!league) return []

  const fixtures = await prisma.fixture.findMany({
    where: { competitionId: league.competitionId, kickoffTime: { lte: now } },
    select: { round: true, kickoffTime: true },
  })

  const latestKickoff = new Map<string, Date>()
  for (const f of fixtures) {
    const existing = latestKickoff.get(f.round)
    if (!existing || f.kickoffTime > existing) latestKickoff.set(f.round, f.kickoffTime)
  }

  return [...latestKickoff.entries()]
    .sort(([, a], [, b]) => b.getTime() - a.getTime())
    .map(([round]) => round)
}
