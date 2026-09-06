/**
 * Which medal a leaderboard row earns, or 0 for none.
 *
 * Mirrors `app/leaderboard/podium.ts` on the web deliberately: the two clients
 * must not disagree about who won a gameweek.
 *
 * It reads `rank`, not the row's position, so players level on points share a
 * medal instead of having gold and silver decided by sort order. And nobody
 * medals on zero — a round whose results a host hasn't confirmed scores every
 * player zero, which would otherwise hand out three medals at random.
 */
export function podiumRank(row: { rank: number; totalPoints: number }): 0 | 1 | 2 | 3 {
  if (row.totalPoints <= 0) return 0
  if (row.rank === 1) return 1
  if (row.rank === 2) return 2
  if (row.rank === 3) return 3
  return 0
}
