import type { MobileFixture } from "@/lib/api"

export type FixtureRound = {
  key: string
  round: string
  competitionId: string
  competitionName: string
  /** Earliest kickoff in the round — what the round header dates itself from. */
  kickoff: Date
  /** Latest kickoff in the round — what "newest round first" sorts on. */
  latestKickoff: Date
  fixtures: MobileFixture[]
}

/**
 * Group fixtures by competition + round (same idea as web `groupByRound`).
 * Preserves arrival order of first fixture in each group.
 */
export function groupByRound(fixtures: MobileFixture[]): FixtureRound[] {
  const groups: FixtureRound[] = []
  const byKey = new Map<string, FixtureRound>()

  for (const f of fixtures) {
    const key = `${f.competitionId}·${f.round}`
    let group = byKey.get(key)
    if (!group) {
      group = {
        key,
        round: f.round,
        competitionId: f.competitionId,
        competitionName: f.competitionName,
        kickoff: new Date(f.kickoffTime),
        latestKickoff: new Date(f.kickoffTime),
        fixtures: [],
      }
      byKey.set(key, group)
      groups.push(group)
    }
    group.fixtures.push(f)
    const kick = new Date(f.kickoffTime)
    if (kick < group.kickoff) group.kickoff = kick
    if (kick > group.latestKickoff) group.latestKickoff = kick
  }

  return groups
}

/**
 * Newest round first, matching the web results page. Sorting on the *latest*
 * kickoff (not the earliest) keeps a round that trickles on for a week above
 * one that started later but finished first.
 */
export function sortRoundsNewestFirst(rounds: FixtureRound[]): FixtureRound[] {
  return [...rounds].sort((a, b) => b.latestKickoff.getTime() - a.latestKickoff.getTime())
}

/**
 * How many upcoming gameweeks the predict tab shows per competition — mirrors
 * the web's VISIBLE_OPEN_ROUNDS. The mobile API also caps `status=open`; this
 * keeps the client honest if an older server omits the filter.
 */
export const VISIBLE_OPEN_ROUNDS = 2

/**
 * Keep only the nearest `perCompetition` rounds for each competition.
 * Relies on `groupByRound` preserving kickoff-ascending arrival order.
 */
export function takeNearestRounds(
  rounds: FixtureRound[],
  perCompetition: number = VISIBLE_OPEN_ROUNDS,
): FixtureRound[] {
  const taken = new Map<string, number>()
  return rounds.filter((group) => {
    const soFar = taken.get(group.competitionId) ?? 0
    if (soFar >= perCompetition) return false
    taken.set(group.competitionId, soFar + 1)
    return true
  })
}
