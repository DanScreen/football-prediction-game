import { describe, expect, it } from "vitest"
import {
  takeNearestFixturesByRound,
  takeNearestRounds,
  VISIBLE_OPEN_ROUNDS,
} from "@/lib/visibleOpenRounds"

describe("takeNearestFixturesByRound", () => {
  it("keeps fixtures from the nearest rounds only", () => {
    const fixtures = [
      { competitionId: "pl", round: "Matchweek 5", id: "a" },
      { competitionId: "pl", round: "Matchweek 5", id: "b" },
      { competitionId: "pl", round: "Matchweek 6", id: "c" },
      { competitionId: "pl", round: "Matchweek 8", id: "d" },
      { competitionId: "pl", round: "Matchweek 9", id: "e" },
    ]

    expect(
      takeNearestFixturesByRound(fixtures, VISIBLE_OPEN_ROUNDS).map((f) => f.id),
    ).toEqual(["a", "b", "c"])
  })

  it("counts the cap per competition", () => {
    const fixtures = [
      { competitionId: "pl", round: "Matchweek 5", id: "a" },
      { competitionId: "wc", round: "Group Stage", id: "b" },
      { competitionId: "pl", round: "Matchweek 6", id: "c" },
      { competitionId: "wc", round: "Round of 16", id: "d" },
      { competitionId: "pl", round: "Matchweek 8", id: "e" },
    ]

    expect(takeNearestFixturesByRound(fixtures, 2).map((f) => f.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ])
  })
})

describe("takeNearestRounds", () => {
  it("keeps only the nearest round groups", () => {
    const rounds = [
      { fixtures: [{ competitionId: "pl", round: "Matchweek 5" }] },
      { fixtures: [{ competitionId: "pl", round: "Matchweek 6" }] },
      { fixtures: [{ competitionId: "pl", round: "Matchweek 8" }] },
    ]

    expect(takeNearestRounds(rounds, 2)).toHaveLength(2)
    expect(takeNearestRounds(rounds, 2).map((g) => g.fixtures[0].round)).toEqual([
      "Matchweek 5",
      "Matchweek 6",
    ])
  })
})
