import { describe, it, expect } from "vitest"
import { roundParam, selectedRound, roundHref } from "./roundNav"

describe("roundParam", () => {
  it("namespaces the param per league", () => {
    expect(roundParam("l1")).toBe("gw-l1")
    expect(roundParam("l2")).not.toBe(roundParam("l1"))
  })
})

describe("selectedRound", () => {
  const played = ["Matchday 5", "Matchday 4"]

  it("is null with no param — the season table is the default", () => {
    expect(selectedRound({}, "l1", played)).toBeNull()
  })

  it("returns a round that has been played", () => {
    expect(selectedRound({ "gw-l1": "Matchday 4" }, "l1", played)).toBe("Matchday 4")
  })

  it("ignores another league's selection", () => {
    expect(selectedRound({ "gw-l2": "Matchday 4" }, "l1", played)).toBeNull()
  })

  it("falls back to overall for a round that hasn't kicked off", () => {
    expect(selectedRound({ "gw-l1": "Matchday 9" }, "l1", played)).toBeNull()
  })

  it("falls back to overall when nothing has been played at all", () => {
    expect(selectedRound({ "gw-l1": "Matchday 4" }, "l1", [])).toBeNull()
  })

  it("takes the first value of a repeated param", () => {
    expect(selectedRound({ "gw-l1": ["Matchday 4", "Matchday 5"] }, "l1", played)).toBe(
      "Matchday 4",
    )
  })
})

describe("roundHref", () => {
  it("selects a round", () => {
    expect(roundHref({}, "l1", "Matchday 5")).toBe("/leaderboard?gw-l1=Matchday+5")
  })

  it("drops the param to go back to overall", () => {
    expect(roundHref({ "gw-l1": "Matchday 5" }, "l1", null)).toBe("/leaderboard")
  })

  it("keeps ?archived=1 — the stepper must not close the finished leagues", () => {
    expect(roundHref({ archived: "1" }, "l1", "Matchday 5")).toBe(
      "/leaderboard?archived=1&gw-l1=Matchday+5",
    )
  })

  it("keeps another league's selection", () => {
    const href = roundHref({ "gw-l2": "Matchday 3" }, "l1", "Matchday 5")
    expect(href).toContain("gw-l2=Matchday+3")
    expect(href).toContain("gw-l1=Matchday+5")
  })

  it("replaces this league's own selection rather than appending", () => {
    const href = roundHref({ "gw-l1": "Matchday 3" }, "l1", "Matchday 5")
    expect(href).toBe("/leaderboard?gw-l1=Matchday+5")
  })

  it("encodes a round name with characters that would break the query", () => {
    const href = roundHref({}, "l1", "Round of 16 & replays")
    expect(href).toBe("/leaderboard?gw-l1=Round+of+16+%26+replays")
    expect(selectedRound({ "gw-l1": "Round of 16 & replays" }, "l1", ["Round of 16 & replays"])).toBe(
      "Round of 16 & replays",
    )
  })
})
