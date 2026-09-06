/**
 * Which medal a row earns, or 0 for none.
 *
 * Two rules, both of which only started to matter once the table could be
 * scoped to a single gameweek:
 *
 * - It reads `rank`, not the row's position. Players level on points share a
 *   rank, so joint-first must mean two golds rather than a gold and a silver
 *   decided by whichever name the sort happened to put first.
 * - Nobody medals on zero. A round whose results a host hasn't confirmed yet
 *   scores every player zero, and the season table does the same before the
 *   first result lands — without this the page would award three medals at
 *   random for a gameweek nobody has been scored on.
 */
export function podiumRank(entry: { rank: number; confirmedPoints: number }): 0 | 1 | 2 | 3 {
  if (entry.confirmedPoints <= 0) return 0
  if (entry.rank === 1) return 1
  if (entry.rank === 2) return 2
  if (entry.rank === 3) return 3
  return 0
}
