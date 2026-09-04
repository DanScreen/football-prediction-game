import type { MobileFixture } from "@/lib/api"

export type FixtureRound = {
  key: string
  round: string
  competitionId: string
  competitionName: string
  kickoff: Date
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
        fixtures: [],
      }
      byKey.set(key, group)
      groups.push(group)
    }
    group.fixtures.push(f)
    const kick = new Date(f.kickoffTime)
    if (kick < group.kickoff) group.kickoff = kick
  }

  return groups
}
