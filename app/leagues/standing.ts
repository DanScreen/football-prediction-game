/**
 * A league card's one-line summary of where the viewer stands: position, points
 * and the gap to the player directly above. Pure, so it is unit-tested; the app
 * shows the same three facts on its league cards.
 */
export type Standing = {
  /** "1st", "2nd", … — ties share a place, as on the leaderboard. */
  position: string
  players: number
  points: number
  /** "Top of the league" / "3 behind Marcus" / "Level with Marcus"; null alone. */
  line: string | null
}

type Row = { id: string; rank: number; displayName: string; confirmedPoints: number }

export function ordinal(n: number): string {
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

/** Half-points are real (a "close" pick scores 1.5), so round to one decimal. */
function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** `rows` must already be sorted best-first, as `computeLeaderboard` returns them. */
export function describeStanding(rows: Row[], userId: string): Standing | null {
  const index = rows.findIndex((r) => r.id === userId)
  if (index === -1) return null
  const me = rows[index]
  const above = index > 0 ? rows[index - 1] : undefined

  let line: string | null = null
  if (rows.length >= 2) {
    if (me.rank === 1) line = "Top of the league"
    else if (above) {
      const gap = round1(above.confirmedPoints - me.confirmedPoints)
      line = gap === 0 ? `Level with ${above.displayName}` : `${gap} behind ${above.displayName}`
    }
  }

  return {
    position: ordinal(me.rank),
    players: rows.length,
    points: round1(me.confirmedPoints),
    line,
  }
}
