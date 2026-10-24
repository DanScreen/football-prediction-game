import { describe, expect, it } from "vitest"
import { roundsMissingBanker } from "@/lib/bankerNudge"

const round = (competitionId: string, name: string) => ({
  key: `${competitionId}·${name}`,
  fixtures: [{ competitionId }],
})

describe("roundsMissingBanker", () => {
  it("flags the nearest round when it has no banker", () => {
    const rounds = [round("pl", "Matchweek 5"), round("pl", "Matchweek 6")]
    expect(roundsMissingBanker(rounds, new Set()).map((r) => r.key)).toEqual(["pl·Matchweek 5"])
  })

  it("stays quiet when the nearest round has a banker, even if a later one doesn't", () => {
    const rounds = [round("pl", "Matchweek 5"), round("pl", "Matchweek 6")]
    expect(roundsMissingBanker(rounds, new Set(["pl·Matchweek 5"]))).toEqual([])
  })

  it("checks each competition's nearest round separately", () => {
    const rounds = [
      round("pl", "Matchweek 5"),
      round("wc", "Group Stage"),
      round("pl", "Matchweek 6"),
      round("wc", "Round of 16"),
    ]
    expect(roundsMissingBanker(rounds, new Set(["pl·Matchweek 5"])).map((r) => r.key)).toEqual([
      "wc·Group Stage",
    ])
  })

  it("returns nothing when there are no open rounds", () => {
    expect(roundsMissingBanker([], new Set())).toEqual([])
  })
})
