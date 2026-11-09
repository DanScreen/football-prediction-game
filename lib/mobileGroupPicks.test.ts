import { describe, it, expect } from "vitest"
import { groupPicksByScore, type PickLike } from "../apps/mobile/lib/groupPicks"

// Not imported from the app's `lib/api`: the web build type-checks this file and
// cannot resolve that module's `@/` imports. The shape below is what the API sends.
type FixturePrediction = PickLike & { userId: string; displayName: string; isBot: boolean }

function pick(
  displayName: string,
  homeScore: number,
  awayScore: number,
  overrides: Partial<FixturePrediction> = {},
): FixturePrediction {
  return {
    userId: displayName.toLowerCase(),
    displayName,
    isBot: false,
    homeScore,
    awayScore,
    isBanker: false,
    pointsAwarded: null,
    provisionalPoints: null,
    ...overrides,
  }
}

describe("groupPicksByScore", () => {
  it("returns an empty list for no picks", () => {
    expect(groupPicksByScore([])).toEqual([])
  })

  it("groups people who picked the same scoreline, in arrival order", () => {
    const groups = groupPicksByScore([
      pick("Bob", 1, 1),
      pick("Marcus", 2, 0),
      pick("Priya", 1, 1),
    ])
    expect(groups).toHaveLength(2)
    const draw = groups.find((g) => g.homeScore === 1 && g.awayScore === 1)
    expect(draw?.picks.map((p) => p.displayName)).toEqual(["Bob", "Priya"])
  })

  it("undoes the banker doubling when computing basePoints", () => {
    const groups = groupPicksByScore([
      pick("Banker", 2, 1, { isBanker: true, pointsAwarded: 6 }),
      pick("Plain", 2, 1, { pointsAwarded: 3 }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].basePoints).toBe(3)
  })

  it("sorts by base points, then group size, then scoreline; unsettled last", () => {
    const groups = groupPicksByScore([
      pick("A", 0, 0, { pointsAwarded: 0 }),
      pick("B", 3, 3, { provisionalPoints: null }),
      pick("C", 2, 1, { pointsAwarded: 1.5 }),
      pick("D", 1, 0, { pointsAwarded: 3 }),
      pick("E", 0, 2, { pointsAwarded: 3 }),
      pick("F", 0, 2, { pointsAwarded: 3 }),
    ])
    expect(groups.map((g) => [g.homeScore, g.awayScore, g.basePoints])).toEqual([
      // Both score 3, but 0-2 has two pickers so it comes first; 1-0 has one.
      [0, 2, 3],
      [1, 0, 3],
      [2, 1, 1.5],
      [0, 0, 0],
      [3, 3, null],
    ])
  })

  it("falls back to provisional points when nothing is settled", () => {
    const groups = groupPicksByScore([
      pick("Bob", 1, 0, { provisionalPoints: 3 }),
      pick("Ann", 1, 0, { isBanker: true, provisionalPoints: 6 }),
    ])
    expect(groups[0].basePoints).toBe(3)
  })
})
