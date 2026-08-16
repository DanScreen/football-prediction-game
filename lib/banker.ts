import { prisma } from "@/lib/prisma"

export type BankerResult = { ok: true } | { ok: false; error: string }

/**
 * Set or clear the user's banker for a gameweek.
 *
 * A banker doubles the points from one fixture per round. The round lives on
 * Fixture rather than Prediction, so "one per (user, competition, round)" can't
 * be a unique index — it's enforced here instead, inside a transaction that
 * clears the previous pick and sets the new one together.
 *
 * Two locking rules, both to stop the pick being made with hindsight:
 *  - you can't banker a fixture that has already kicked off; and
 *  - you can't move a banker off a fixture that has already kicked off, which
 *    would otherwise let someone bank a match, watch it go badly, and shift the
 *    double onto a later kickoff in the same round.
 *
 * Membership is the caller's responsibility (the server action checks it).
 */
export async function setBanker(
  userId: string,
  fixtureId: string,
  on: boolean,
): Promise<BankerResult> {
  return prisma.$transaction(async (tx) => {
    const fixture = await tx.fixture.findUnique({
      where: { id: fixtureId },
      select: { id: true, competitionId: true, round: true, kickoffTime: true },
    })
    if (!fixture) return { ok: false as const, error: "Fixture not found." }

    const now = new Date()
    if (fixture.kickoffTime <= now) {
      return { ok: false as const, error: "This fixture has kicked off — bankers are locked." }
    }

    const prediction = await tx.prediction.findUnique({
      where: { userId_fixtureId: { userId, fixtureId } },
      select: { id: true },
    })
    if (!prediction) {
      return { ok: false as const, error: "Predict this fixture first, then make it your banker." }
    }

    if (!on) {
      await tx.prediction.update({ where: { id: prediction.id }, data: { isBanker: false } })
      return { ok: true as const }
    }

    const roundFixtures = await tx.fixture.findMany({
      where: { competitionId: fixture.competitionId, round: fixture.round },
      select: { id: true, homeTeam: true, awayTeam: true, kickoffTime: true },
    })
    const roundFixtureById = new Map(roundFixtures.map((f) => [f.id, f]))

    const existing = await tx.prediction.findMany({
      where: { userId, isBanker: true, fixtureId: { in: roundFixtures.map((f) => f.id) } },
      select: { id: true, fixtureId: true },
    })

    const locked = existing.find((p) => {
      const f = roundFixtureById.get(p.fixtureId)
      return f !== undefined && f.kickoffTime <= now
    })
    if (locked) {
      const f = roundFixtureById.get(locked.fixtureId)!
      return {
        ok: false as const,
        error: `Your banker is locked — ${f.homeTeam} v ${f.awayTeam} has already kicked off.`,
      }
    }

    await tx.prediction.updateMany({
      where: { id: { in: existing.map((p) => p.id) } },
      data: { isBanker: false },
    })
    await tx.prediction.update({ where: { id: prediction.id }, data: { isBanker: true } })
    return { ok: true as const }
  })
}
