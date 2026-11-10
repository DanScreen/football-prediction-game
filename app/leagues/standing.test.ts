import { describe, expect, it } from "vitest"
import { describeStanding, ordinal } from "./standing"

const row = (id: string, rank: number, confirmedPoints: number) => ({
  id,
  rank,
  displayName: id[0].toUpperCase() + id.slice(1),
  confirmedPoints,
})

describe("ordinal", () => {
  it("handles the teens and the usual endings", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th",
    ])
  })
})

describe("describeStanding", () => {
  const table = [row("marcus", 1, 49), row("alice", 2, 46), row("elena", 3, 44.5)]

  it("gives the gap to the player directly above", () => {
    expect(describeStanding(table, "alice")).toEqual({
      position: "2nd",
      players: 3,
      points: 46,
      line: "3 behind Marcus",
    })
    expect(describeStanding(table, "elena")?.line).toBe("1.5 behind Alice")
  })

  it("says so when you lead, including a shared lead", () => {
    expect(describeStanding(table, "marcus")?.line).toBe("Top of the league")
    const tied = [row("marcus", 1, 49), row("alice", 1, 49)]
    expect(describeStanding(tied, "alice")).toMatchObject({ position: "1st", line: "Top of the league" })
  })

  it("reads level, not '0 behind', when tied below the top", () => {
    const tied = [row("marcus", 1, 49), row("alice", 2, 46), row("elena", 2, 46)]
    expect(describeStanding(tied, "elena")?.line).toBe("Level with Alice")
  })

  it("has no comparison line in a league of one, and nothing for a non-member", () => {
    expect(describeStanding([row("alice", 1, 0)], "alice")).toMatchObject({ position: "1st", line: null })
    expect(describeStanding(table, "nobody")).toBeNull()
  })
})
