import { describe, it, expect } from "vitest"
import { podiumRank } from "./podium"

describe("podiumRank", () => {
  it("medals the top three", () => {
    expect(podiumRank({ rank: 1, confirmedPoints: 10 })).toBe(1)
    expect(podiumRank({ rank: 2, confirmedPoints: 8 })).toBe(2)
    expect(podiumRank({ rank: 3, confirmedPoints: 6 })).toBe(3)
  })

  it("gives fourth place nothing", () => {
    expect(podiumRank({ rank: 4, confirmedPoints: 5 })).toBe(0)
  })

  it("gives joint-first two golds rather than a gold and a silver", () => {
    expect(podiumRank({ rank: 1, confirmedPoints: 10 })).toBe(1)
    // The second row of a tie carries rank 1 too.
    expect(podiumRank({ rank: 1, confirmedPoints: 10 })).toBe(1)
  })

  it("medals nobody on zero — an unconfirmed gameweek is not a podium", () => {
    expect(podiumRank({ rank: 1, confirmedPoints: 0 })).toBe(0)
    expect(podiumRank({ rank: 2, confirmedPoints: 0 })).toBe(0)
  })

  it("medals nobody on negative points", () => {
    expect(podiumRank({ rank: 1, confirmedPoints: -2 })).toBe(0)
  })
})
