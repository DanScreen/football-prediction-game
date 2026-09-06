/**
 * Gameweek selection for the leaderboard page, kept in the URL.
 *
 * The page stacks every league the viewer belongs to, and leagues can sit on
 * different competitions with different round names — so the selection is *per
 * league*, one query param each, rather than a single shared `?round=`.
 *
 * In the URL rather than component state so a gameweek table can be linked to
 * and argued about ("look at matchday 5"), and so the back button steps through
 * the rounds you looked at. That is the one real difference from the app, where
 * the same picker is local state; there is no URL to share in a native tab.
 */

export type SearchParams = Record<string, string | string[] | undefined>

/** The query param carrying one league's selected gameweek. */
export function roundParam(leagueId: string): string {
  return `gw-${leagueId}`
}

/**
 * The round a league's table should show, or `null` for the season table.
 *
 * A param naming a round that hasn't kicked off — a stale link, a hand-typed
 * URL, a round that vanished when a host renamed it — falls back to the overall
 * table rather than rendering a table of zeroes for a gameweek nobody played.
 */
export function selectedRound(
  searchParams: SearchParams,
  leagueId: string,
  playedRounds: string[],
): string | null {
  const raw = searchParams[roundParam(leagueId)]
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return null
  return playedRounds.includes(value) ? value : null
}

/**
 * The href that switches one league to `round` (or back to overall with
 * `null`), preserving every other param — `?archived=1` and the other leagues'
 * selections most of all, since losing those would make the stepper feel like
 * it reset the page.
 */
export function roundHref(
  searchParams: SearchParams,
  leagueId: string,
  round: string | null,
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    const single = Array.isArray(value) ? value[0] : value
    if (single !== undefined) params.set(key, single)
  }

  if (round) params.set(roundParam(leagueId), round)
  else params.delete(roundParam(leagueId))

  const query = params.toString()
  return query ? `/leaderboard?${query}` : "/leaderboard"
}
