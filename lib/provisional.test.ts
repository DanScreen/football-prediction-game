import { describe, it, expect } from "vitest"
import { provisionalScore, provisionalPoints } from "./provisional"
import { FixtureStatus } from "@/app/generated/prisma/client"

function fixture(overrides: Partial<Parameters<typeof provisionalScore>[0]> = {}) {
  return {
    status: FixtureStatus.AWAITING_RESULT,
    proposedHomeScore: 2,
    proposedAwayScore: 1,
    ...overrides,
  }
}

describe("provisionalScore", () => {
  it("returns the proposed score for an awaiting fixture", () => {
    expect(provisionalScore(fixture())).toEqual({ home: 2, away: 1 })
  })

  it("is null for SCHEDULED fixtures", () => {
    expect(provisionalScore(fixture({ status: FixtureStatus.SCHEDULED }))).toBeNull()
  })

  it("is null for COMPLETED fixtures (confirmed result supersedes)", () => {
    expect(provisionalScore(fixture({ status: FixtureStatus.COMPLETED }))).toBeNull()
  })

  it("is null when no proposal has been fetched yet", () => {
    expect(
      provisionalScore(fixture({ proposedHomeScore: null, proposedAwayScore: null })),
    ).toBeNull()
  })
})

describe("provisionalPoints", () => {
  it("scores the prediction against the proposed score", () => {
    expect(
      provisionalPoints({ predictedHomeScore: 2, predictedAwayScore: 1 }, fixture()),
    ).toBe(3)
    expect(
      provisionalPoints({ predictedHomeScore: 3, predictedAwayScore: 2 }, fixture()),
    ).toBe(1.5)
    expect(
      provisionalPoints({ predictedHomeScore: 3, predictedAwayScore: 1 }, fixture()),
    ).toBe(1)
    expect(
      provisionalPoints({ predictedHomeScore: 0, predictedAwayScore: 0 }, fixture()),
    ).toBe(0)
  })

  it("is null when there is no provisional score", () => {
    expect(
      provisionalPoints(
        { predictedHomeScore: 2, predictedAwayScore: 1 },
        fixture({ status: FixtureStatus.COMPLETED }),
      ),
    ).toBeNull()
  })
})
