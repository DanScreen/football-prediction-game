import { describe, it, expect } from "vitest"
import { scoreOnePrediction, qualifiesForGrandSlam, awardedPoints } from "./scoring"

describe("scoreOnePrediction", () => {
  describe("exact score → 3 pts", () => {
    it("home win exact", () => expect(scoreOnePrediction(2, 1, 2, 1)).toBe(3))
    it("away win exact", () => expect(scoreOnePrediction(0, 2, 0, 2)).toBe(3))
    it("draw exact (0-0)", () => expect(scoreOnePrediction(0, 0, 0, 0)).toBe(3))
    it("draw exact (2-2)", () => expect(scoreOnePrediction(2, 2, 2, 2)).toBe(3))
  })

  describe("correct result + correct goal diff, not exact → 1.5 pts", () => {
    it("home win, same diff (+2)", () => expect(scoreOnePrediction(2, 0, 3, 1)).toBe(1.5))
    it("home win, same diff (+1)", () => expect(scoreOnePrediction(1, 0, 3, 2)).toBe(1.5))
    it("away win, same diff (-1)", () => expect(scoreOnePrediction(0, 1, 1, 2)).toBe(1.5))
    it("draw (any draw vs any other draw)", () => expect(scoreOnePrediction(1, 1, 2, 2)).toBe(1.5))
    it("draw 0-0 vs 3-3", () => expect(scoreOnePrediction(0, 0, 3, 3)).toBe(1.5))
  })

  describe("correct result only → 1 pt", () => {
    it("home win, diff 2 vs diff 1", () => expect(scoreOnePrediction(2, 0, 2, 1)).toBe(1))
    it("home win, diff 1 vs diff 3", () => expect(scoreOnePrediction(1, 0, 4, 1)).toBe(1))
    it("away win, diff 1 vs diff 2", () => expect(scoreOnePrediction(0, 1, 0, 2)).toBe(1))
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
    it("high-scoring same diff", () => expect(scoreOnePrediction(5, 3, 6, 4)).toBe(1.5))
  })
})

describe("qualifiesForGrandSlam", () => {
  it("all correct → true", () => expect(qualifiesForGrandSlam([true, true, true])).toBe(true))
  it("one wrong → false", () => expect(qualifiesForGrandSlam([true, false, true])).toBe(false))
  it("all wrong → false", () => expect(qualifiesForGrandSlam([false, false])).toBe(false))
  it("empty array → false", () => expect(qualifiesForGrandSlam([])).toBe(false))
  it("single correct → true", () => expect(qualifiesForGrandSlam([true])).toBe(true))
})

describe("awardedPoints", () => {
  it("leaves a normal pick alone", () => expect(awardedPoints(3, false)).toBe(3))
  it("doubles a banker", () => expect(awardedPoints(3, true)).toBe(6))
  it("doubles a half-point score cleanly", () => expect(awardedPoints(1.5, true)).toBe(3))
  // Upside-only by design: doubling zero can't cost you anything.
  it("doubles zero to zero", () => expect(awardedPoints(0, true)).toBe(0))
})
