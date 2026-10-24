type RoundGroup = {
  key: string
  fixtures: { competitionId: string }[]
}

/**
 * The open gameweeks to warn about for having no banker set.
 *
 * Only the nearest open round in each competition counts — that's the one with a
 * live deadline. Nagging about next week's banker while this week's is sorted
 * would just be noise. A competition whose nearest round already has a banker
 * produces nothing, even if a later round doesn't.
 *
 * Relies on `rounds` being in kickoff order (as `groupByRound` returns them).
 * `bankered` holds the `competitionId·round` keys the player has a banker in.
 */
export function roundsMissingBanker<G extends RoundGroup>(
  rounds: G[],
  bankered: ReadonlySet<string>,
): G[] {
  const seen = new Set<string>()
  const missing: G[] = []
  for (const group of rounds) {
    const { competitionId } = group.fixtures[0]
    if (seen.has(competitionId)) continue
    seen.add(competitionId)
    if (!bankered.has(group.key)) missing.push(group)
  }
  return missing
}
