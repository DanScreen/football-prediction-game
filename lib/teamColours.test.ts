import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { normaliseTeam, teamColours } from "./teamColours"

describe("teamColours", () => {
  it("matches football-data short names and long forms alike", () => {
    expect(teamColours("Man City")).toEqual(teamColours("Manchester City FC"))
    expect(teamColours("Arsenal")?.primary).toBe("#EF0107")
    expect(teamColours("AFC Bournemouth")).not.toBeNull()
  })

  it("returns null rather than guessing for an unknown team", () => {
    expect(teamColours("Winner of Match 49")).toBeNull()
    expect(teamColours("")).toBeNull()
  })

  it("normalises case, punctuation and the FC suffix", () => {
    expect(normaliseTeam("  Nott'm   Forest F.C. ")).toBe("nottm forest")
  })

  it("stays in step with the mobile mirror", () => {
    const body = (p: string) => readFileSync(p, "utf8").split("export type")[1]
    expect(body("apps/mobile/lib/teamColours.ts")).toBe(body("lib/teamColours.ts"))
  })
})
