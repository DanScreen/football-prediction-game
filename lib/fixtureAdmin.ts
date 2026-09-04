import { prisma } from "@/lib/prisma"

export type FixtureAdminResult = { ok: true; message: string } | { ok: false; error: string }

/** Bulk fixture surgery for the host gameweek editor (`/host/fixtures/editor`).
 *
 * Real competitions don't divide neatly: a round gets split across two weekends
 * for TV, a postponed match is replayed mid-season, a cup tie lands in the middle
 * of a league round. Hosts need to re-cut gameweeks by hand, which the one-at-a-time
 * edit form makes tedious and error-prone.
 *
 * Both operations refuse to touch settled history — see the guards below.
 */

function list(fixtures: { homeTeam: string; awayTeam: string }[]): string {
  const names = fixtures.map((f) => `${f.homeTeam} v ${f.awayTeam}`)
  if (names.length <= 3) return names.join(", ")
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`
}

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many)

/**
 * Move fixtures into `round`.
 *
 * Settled fixtures are refused: `RoundBonus` is keyed by (user, league, round)
 * and points are already awarded against the old label, so moving one would
 * silently rewrite a finished gameweek's scoring.
 *
 * The banker rule — one per (user, competition, round) — has no database
 * constraint to lean on (the round lives on Fixture, not Prediction), so a move
 * can carry a second banker into a round a player has already bankered. Where
 * that happens the *arriving* banker is cleared, not the one already there: the
 * player chose that pick against the round as they saw it, and the moved fixture
 * is the thing that changed underneath them.
 */
export async function reassignRound(
  fixtureIds: string[],
  round: string,
): Promise<FixtureAdminResult> {
  const target = round.trim()
  if (!target) return { ok: false, error: "Enter a gameweek to move them to." }
  if (fixtureIds.length === 0) return { ok: false, error: "Select at least one fixture." }

  return prisma.$transaction(async (tx) => {
    const fixtures = await tx.fixture.findMany({
      where: { id: { in: fixtureIds } },
      select: {
        id: true,
        competitionId: true,
        round: true,
        status: true,
        homeTeam: true,
        awayTeam: true,
      },
    })
    if (fixtures.length !== fixtureIds.length) {
      return { ok: false as const, error: "Some fixtures no longer exist — reload and try again." }
    }

    const settled = fixtures.filter((f) => f.status === "COMPLETED")
    if (settled.length > 0) {
      return {
        ok: false as const,
        error: `${list(settled)} already ${plural(settled.length, "has", "have")} a result. Moving a settled fixture would rewrite the gameweek its points and streak bonuses were scored in.`,
      }
    }

    const moving = fixtures.filter((f) => f.round !== target)
    if (moving.length === 0) {
      return { ok: true as const, message: `Already in ${target} — nothing to do.` }
    }

    await tx.fixture.updateMany({
      where: { id: { in: moving.map((f) => f.id) } },
      data: { round: target },
    })

    let cleared = 0
    for (const competitionId of new Set(moving.map((f) => f.competitionId))) {
      const arrivedIds = new Set(
        moving.filter((f) => f.competitionId === competitionId).map((f) => f.id),
      )
      const roundFixtures = await tx.fixture.findMany({
        where: { competitionId, round: target },
        select: { id: true },
      })
      const bankers = await tx.prediction.findMany({
        where: { isBanker: true, fixtureId: { in: roundFixtures.map((f) => f.id) } },
        select: { id: true, userId: true, fixtureId: true },
      })

      const byUser = new Map<string, typeof bankers>()
      for (const b of bankers) {
        const found = byUser.get(b.userId)
        if (found) found.push(b)
        else byUser.set(b.userId, [b])
      }

      const toClear: string[] = []
      for (const picks of byUser.values()) {
        if (picks.length < 2) continue
        const arrivals = picks.filter((p) => arrivedIds.has(p.fixtureId))
        const resident = picks.filter((p) => !arrivedIds.has(p.fixtureId))
        // Every banker arrived together: no incumbent to defer to, so keep the first.
        toClear.push(...(resident.length > 0 ? arrivals : picks.slice(1)).map((p) => p.id))
      }

      if (toClear.length > 0) {
        await tx.prediction.updateMany({
          where: { id: { in: toClear } },
          data: { isBanker: false },
        })
        cleared += toClear.length
      }
    }

    const moved = `Moved ${moving.length} ${plural(moving.length, "fixture")} to ${target}.`
    return {
      ok: true as const,
      message:
        cleared === 0
          ? moved
          : `${moved} Cleared ${cleared} duplicate banker ${plural(cleared, "pick")} — those players will need to pick a banker again.`,
    }
  })
}

/**
 * Delete fixtures outright.
 *
 * Refuses any fixture carrying predictions: those are picks players made, and
 * `Prediction.fixture` has no cascade, so the delete would fail at the foreign
 * key anyway — better to say why than to surface a constraint error. Settled
 * fixtures are refused for the same reason as above.
 */
export async function deleteFixtures(fixtureIds: string[]): Promise<FixtureAdminResult> {
  if (fixtureIds.length === 0) return { ok: false, error: "Select at least one fixture." }

  return prisma.$transaction(async (tx) => {
    const fixtures = await tx.fixture.findMany({
      where: { id: { in: fixtureIds } },
      select: {
        id: true,
        homeTeam: true,
        awayTeam: true,
        status: true,
        _count: { select: { predictions: true } },
      },
    })
    if (fixtures.length !== fixtureIds.length) {
      return { ok: false as const, error: "Some fixtures no longer exist — reload and try again." }
    }

    const settled = fixtures.filter((f) => f.status === "COMPLETED")
    if (settled.length > 0) {
      return {
        ok: false as const,
        error: `${list(settled)} already ${plural(settled.length, "has", "have")} a result — settled fixtures can't be deleted.`,
      }
    }

    const picked = fixtures.filter((f) => f._count.predictions > 0)
    if (picked.length > 0) {
      const total = picked.reduce((n, f) => n + f._count.predictions, 0)
      return {
        ok: false as const,
        error: `${list(picked)} ${plural(picked.length, "has", "have")} ${total} ${plural(total, "prediction")} against ${plural(picked.length, "it", "them")}. Deleting would throw away picks players have made — move ${plural(picked.length, "it", "them")} to another gameweek instead.`,
      }
    }

    await tx.fixture.deleteMany({ where: { id: { in: fixtures.map((f) => f.id) } } })
    return {
      ok: true as const,
      message: `Deleted ${fixtures.length} ${plural(fixtures.length, "fixture")}.`,
    }
  })
}
