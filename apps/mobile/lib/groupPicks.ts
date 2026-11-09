/**
 * Grouping league-mates' picks by scoreline, for the app's Results cards.
 *
 * MIRROR of the repo root's `lib/groupPicks.ts`; this is the copy the app runs.
 * The root one exists so the logic can be unit-tested: the root vitest can't
 * transform files under `apps/mobile` in CI, where the app's dependencies (and
 * the Expo tsconfig that directory extends) aren't installed. A test checks the
 * two stay identical. The fields are declared structurally so neither copy
 * imports anything.
 */
export type PickLike = {
  homeScore: number
  awayScore: number
  isBanker: boolean
  pointsAwarded: number | null
  provisionalPoints: number | null
}

export type PickGroup<P extends PickLike = PickLike> = {
  homeScore: number
  awayScore: number
  /** Everyone who picked this scoreline, in the order they arrived. */
  picks: P[]
  /** Points for this scoreline BEFORE any banker doubling, or null if unsettled. */
  basePoints: number | null
}

/** Undo the banker doubling so every pick on a scoreline reports the same base. */
function undoBanker(points: number, isBanker: boolean): number {
  return isBanker ? points / 2 : points
}

function groupBasePoints(picks: PickLike[]): number | null {
  const settled = picks.find((p) => p.pointsAwarded != null)
  if (settled) return undoBanker(settled.pointsAwarded as number, settled.isBanker)
  const provisional = picks.find((p) => p.provisionalPoints != null)
  if (provisional) return undoBanker(provisional.provisionalPoints as number, provisional.isBanker)
  return null
}

/**
 * Collapse league-mates' picks into one row per scoreline. Groups are sorted by
 * base points (highest first, unsettled last), then by how many people picked
 * them, then by scoreline, so the order is stable across renders.
 */
export function groupPicksByScore<P extends PickLike>(peers: P[]): PickGroup<P>[] {
  const byKey = new Map<string, PickGroup<P>>()
  for (const p of peers) {
    const key = `${p.homeScore}-${p.awayScore}`
    let group = byKey.get(key)
    if (!group) {
      group = { homeScore: p.homeScore, awayScore: p.awayScore, picks: [], basePoints: null }
      byKey.set(key, group)
    }
    group.picks.push(p)
  }

  const groups = [...byKey.values()]
  for (const g of groups) g.basePoints = groupBasePoints(g.picks)

  return groups.sort((a, b) => {
    if (a.basePoints !== b.basePoints) {
      if (a.basePoints === null) return 1
      if (b.basePoints === null) return -1
      return b.basePoints - a.basePoints
    }
    if (a.picks.length !== b.picks.length) return b.picks.length - a.picks.length
    if (a.homeScore !== b.homeScore) return a.homeScore - b.homeScore
    return a.awayScore - b.awayScore
  })
}
