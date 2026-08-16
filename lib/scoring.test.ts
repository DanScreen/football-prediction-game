import { describe, it, expect } from "vitest"
import { scoreOnePrediction, streakPoints, awardedPoints } from "./scoring"

describe("scoreOnePrediction", () => {
  describe("exact score → 3 pts", () => {
    it("home win exact", () => expect(scoreOnePrediction(2, 1, 2, 1)).toBe(3))
    it("away win exact", () => expect(scoreOnePrediction(0, 2, 0, 2)).toBe(3))
    it("draw exact (0-0)", () => expect(scoreOnePrediction(0, 0, 0, 0)).toBe(3))
    it("draw exact (2-2)", () => expect(scoreOnePrediction(2, 2, 2, 2)).toBe(3))
  })

  describe("close: right result, within one goal → 1.5 pts", () => {
    // One side spot-on, the other out by one. Goal difference changes.
    it("home win, away side out by one (2-0 for 2-1)", () =>
      expect(scoreOnePrediction(2, 0, 2, 1)).toBe(1.5))
    it("home win, home side out by one (3-1 for 2-1)", () =>
      expect(scoreOnePrediction(3, 1, 2, 1)).toBe(1.5))
    it("away win, out by one (0-2 for 0-3)", () => expect(scoreOnePrediction(0, 2, 0, 3)).toBe(1.5))

    // Both sides out by one the same way, so the goal difference survives.
    it("home win, both out by one up (3-2 for 2-1)", () =>
      expect(scoreOnePrediction(3, 2, 2, 1)).toBe(1.5))
    it("home win, both out by one down (1-0 for 2-1)", () =>
      expect(scoreOnePrediction(1, 0, 2, 1)).toBe(1.5))
    it("away win, both out by one (1-2 for 0-1)", () =>
      expect(scoreOnePrediction(1, 2, 0, 1)).toBe(1.5))
    it("draw, one either side (1-1 for 2-2)", () => expect(scoreOnePrediction(1, 1, 2, 2)).toBe(1.5))
    it("draw, 0-0 for 1-1", () => expect(scoreOnePrediction(0, 0, 1, 1)).toBe(1.5))
  })

  describe("correct result only → 1 pt", () => {
    // Right goal difference is not enough on its own once you're 2+ goals out.
    it("home win, same diff but two out (2-0 for 4-2)", () =>
      expect(scoreOnePrediction(2, 0, 4, 2)).toBe(1))
    it("draw, same diff but two out (0-0 for 3-3)", () =>
      expect(scoreOnePrediction(0, 0, 3, 3)).toBe(1))
    it("draw, same diff but two out (1-1 for 3-3)", () =>
      expect(scoreOnePrediction(1, 1, 3, 3)).toBe(1))

    // Out by one on both sides, but in opposite directions: two goals away and
    // the goal difference is wrong by 2.
    it("home win, one out each way (3-0 for 2-1)", () =>
      expect(scoreOnePrediction(3, 0, 2, 1)).toBe(1))
    it("home win, diff 1 vs diff 3", () => expect(scoreOnePrediction(1, 0, 4, 1)).toBe(1))
    it("away win, well off (0-1 for 0-4)", () => expect(scoreOnePrediction(0, 1, 0, 4)).toBe(1))
  })

  describe("wrong result → 0 pts", () => {
    it("predicted home win, actual away win", () => expect(scoreOnePrediction(1, 0, 0, 1)).toBe(0))
    it("predicted away win, actual draw", () => expect(scoreOnePrediction(0, 1, 1, 1)).toBe(0))
    it("predicted draw, actual home win", () => expect(scoreOnePrediction(1, 1, 2, 1)).toBe(0))
    it("same goal diff but different result (1-0 vs 0-1)", () =>
      expect(scoreOnePrediction(1, 0, 0, 1)).toBe(0))
  })

  describe("edge cases", () => {
    it("0-0 draw (exact)", () => expect(scoreOnePrediction(0, 0, 0, 0)).toBe(3))
    it("predicted 0-0, actual 0-1 (diff sides)", () => expect(scoreOnePrediction(0, 0, 0, 1)).toBe(0))
    it("high-scoring exact", () => expect(scoreOnePrediction(5, 3, 5, 3)).toBe(3))
    it("high-scoring, both out by one", () => expect(scoreOnePrediction(5, 3, 6, 4)).toBe(1.5))
    it("high-scoring, same diff but far off", () => expect(scoreOnePrediction(5, 3, 8, 6)).toBe(1))
    // A drawn match can still only pay 3 / 1.5 / 1 / 0 — but 1 is now reachable.
    it("drawn match, out by two, pays the result point", () =>
      expect(scoreOnePrediction(4, 4, 1, 1)).toBe(1))
  })
})

describe("streakPoints", () => {
  it("pays nothing below the lowest tier", () => {
    expect(streakPoints(0)).toBe(0)
    expect(streakPoints(4)).toBe(0)
  })

  // Boundaries both sides of every tier — the whole feature is thresholds.
  it("pays 1 for 5-7 correct", () => {
    expect(streakPoints(5)).toBe(1)
    expect(streakPoints(6)).toBe(1)
    expect(streakPoints(7)).toBe(1)
  })

  it("pays 2 for 8-9 correct", () => {
    expect(streakPoints(8)).toBe(2)
    expect(streakPoints(9)).toBe(2)
  })

  it("pays 3 for 10 or more correct", () => {
    expect(streakPoints(10)).toBe(3)
    expect(streakPoints(11)).toBe(3)
    expect(streakPoints(38)).toBe(3)
  })
})

describe("awardedPoints", () => {
  it("leaves a normal pick alone", () => expect(awardedPoints(3, false)).toBe(3))
  it("doubles a banker", () => expect(awardedPoints(3, true)).toBe(6))
  it("doubles a half-point score cleanly", () => expect(awardedPoints(1.5, true)).toBe(3))
  // Upside-only by design: doubling zero can't cost you anything.
  it("doubles zero to zero", () => expect(awardedPoints(0, true)).toBe(0))
})
