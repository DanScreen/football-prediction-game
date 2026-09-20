/**
 * How many upcoming gameweeks the predict surfaces show per competition: the
 * one you're in and the one after it.
 */
export const VISIBLE_OPEN_ROUNDS = 2

type RoundKeyed = {
  competitionId: string
  round: string
}

/**
 * Keep fixtures that fall in the nearest `perCompetition` rounds.
 *
 * Relies on the caller ordering by kickoff ascending — the first time a round
 * appears is treated as that round's position in the calendar. Later rounds can
 * sit in the database (hand-added fixtures, an earlier import window), but
 * offering picks four gameweeks out isn't the game.
 */
export function takeNearestFixturesByRound<T extends RoundKeyed>(
  fixtures: T[],
  perCompetition: number = VISIBLE_OPEN_ROUNDS,
): T[] {
  const seenRounds = new Map<string, Set<string>>()
  return fixtures.filter((f) => {
    let rounds = seenRounds.get(f.competitionId)
    if (!rounds) {
      rounds = new Set()
      seenRounds.set(f.competitionId, rounds)
    }
    if (rounds.has(f.round)) return true
    if (rounds.size >= perCompetition) return false
    rounds.add(f.round)
    return true
  })
}

export type RoundGroup<T> = {
  fixtures: T[]
}

/**
 * Keep only the nearest `perCompetition` round groups for each competition.
 * Same rule as {@link takeNearestFixturesByRound}, for pre-grouped rounds.
 */
export function takeNearestRounds<T extends RoundKeyed, G extends RoundGroup<T>>(
  rounds: G[],
  perCompetition: number = VISIBLE_OPEN_ROUNDS,
): G[] {
  const taken = new Map<string, number>()
  return rounds.filter((group) => {
    const { competitionId } = group.fixtures[0]
    const soFar = taken.get(competitionId) ?? 0
    if (soFar >= perCompetition) return false
    taken.set(competitionId, soFar + 1)
    return true
  })
}
