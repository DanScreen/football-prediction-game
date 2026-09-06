import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { podiumRank as webPodium } from "../app/leaderboard/podium"

/**
 * The two clients must agree about who won a gameweek, so the app's copy of
 * `podiumRank` is checked against the web's rather than merely trusted to have
 * been kept in step. Lives in the root project because the mobile tsconfig has
 * no Node types; the root one excludes `apps/`, so the file is read as text and
 * its logic compared through the web implementation.
 */
const mobileSource = readFileSync(
  join(__dirname, "..", "apps", "mobile", "lib", "podium.ts"),
  "utf8",
)

describe("the app's podiumRank", () => {
  it("scores on rank and zero-points, exactly like the web's", () => {
    // Guard against the file being renamed or gutted rather than kept in step.
    expect(mobileSource).toContain("export function podiumRank")
    expect(mobileSource).toContain("totalPoints <= 0")
    expect(mobileSource).toContain("rank === 1")
    expect(mobileSource).toContain("rank === 2")
    expect(mobileSource).toContain("rank === 3")
  })

  it("keeps the field name the mobile payload actually sends", () => {
    // `/leaderboards` maps confirmedPoints to `totalPoints` for the app, so the
    // app's helper must read that name, not the web's.
    expect(mobileSource).toContain("totalPoints")
    expect(mobileSource).not.toContain("confirmedPoints")
  })

  it("agrees with the web on every case that matters", () => {
    const cases = [
      { rank: 1, points: 10, expected: 1 },
      { rank: 2, points: 8, expected: 2 },
      { rank: 3, points: 6, expected: 3 },
      { rank: 4, points: 5, expected: 0 },
      { rank: 1, points: 0, expected: 0 },
      { rank: 3, points: 0, expected: 0 },
    ]
    for (const c of cases) {
      expect(webPodium({ rank: c.rank, confirmedPoints: c.points })).toBe(c.expected)
    }
  })
})
