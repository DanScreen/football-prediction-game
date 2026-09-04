import { describe, expect, it } from "vitest"
import { groupByRound, takeNearestRounds, VISIBLE_OPEN_ROUNDS } from "@/app/FixtureRoundGroup"

type TestFixture = {
  competitionId: string
  round: string
  kickoffTime: Date
  competition: { name: string }
}

function fixture(competitionId: string, round: string, day: number): TestFixture {
  return {
    competitionId,
    round,
    kickoffTime: new Date(`2026-09-${String(day).padStart(2, "0")}T14:00:00Z`),
    competition: { name: competitionId === "pl" ? "Premier League" : "La Liga" },
  }
}

describe("takeNearestRounds", () => {
  it("keeps only the nearest rounds and drops the rest", () => {
    const rounds = groupByRound([
      fixture("pl", "Matchweek 3", 6),
      fixture("pl", "Matchweek 4", 12),
      fixture("pl", "Matchweek 8", 23),
      fixture("pl", "Matchweek 9", 30),
    ])

    expect(takeNearestRounds(rounds, VISIBLE_OPEN_ROUNDS).map((g) => g.round)).toEqual([
      "Matchweek 3",
      "Matchweek 4",
    ])
  })

  it("counts the cap per competition, not across all of them", () => {
    const rounds = groupByRound([
      fixture("pl", "Matchweek 3", 6),
      fixture("liga", "Jornada 3", 7),
      fixture("pl", "Matchweek 4", 12),
      fixture("liga", "Jornada 4", 13),
      fixture("pl", "Matchweek 5", 19),
    ])

    expect(takeNearestRounds(rounds, 2).map((g) => g.round)).toEqual([
      "Matchweek 3",
      "Jornada 3",
      "Matchweek 4",
      "Jornada 4",
    ])
  })

  it("leaves a shorter list untouched", () => {
    const rounds = groupByRound([fixture("pl", "Matchweek 3", 6)])
    expect(takeNearestRounds(rounds, 2)).toHaveLength(1)
  })
})
