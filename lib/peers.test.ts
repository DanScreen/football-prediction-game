import { describe, it, expect, vi, beforeEach } from "vitest"
import { resolvePeerContext, NOT_ARCHIVED } from "./peers"
import { prisma } from "@/lib/prisma"

vi.mock("@/lib/prisma", () => ({
  prisma: { leagueMembership: { findMany: vi.fn() } },
}))

const membershipFindMany = vi.mocked(prisma.leagueMembership.findMany)

function membership(
  leagueId: string,
  competitionId: string,
  { archived = false }: { archived?: boolean } = {},
) {
  return {
    leagueId,
    league: {
      name: `${leagueId} FC`,
      competitionId,
      competition: {
        id: competitionId,
        name: competitionId,
        archivedAt: archived ? new Date("2026-01-01") : null,
      },
    },
  }
}

describe("NOT_ARCHIVED", () => {
  it("matches only competitions with no archive stamp", () => {
    expect(NOT_ARCHIVED).toEqual({ archivedAt: null })
  })
})

describe("resolvePeerContext", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns null only when the user is in no leagues at all", async () => {
    membershipFindMany.mockResolvedValueOnce([] as never)
    expect(await resolvePeerContext("u1")).toBeNull()
  })

  it("drops leagues on finished competitions from the core view", async () => {
    membershipFindMany
      .mockResolvedValueOnce([
        membership("l-pl", "PL"),
        membership("l-wc", "WC", { archived: true }),
      ] as never)
      .mockResolvedValueOnce([
        { leagueId: "l-pl", userId: "u1" },
        { leagueId: "l-pl", userId: "u2" },
      ] as never)

    const ctx = await resolvePeerContext("u1")

    expect(ctx?.competitionIds).toEqual(["PL"])
    expect(ctx?.myLeagueIds).toEqual(["l-pl"])
    expect(ctx?.archivedMemberships.map((m) => m.leagueId)).toEqual(["l-wc"])
    // Peers are resolved from live leagues only, so an archived league-mate
    // can't leak into another competition's visible picks.
    expect(ctx?.allPeerIds.sort()).toEqual(["u1", "u2"])
  })

  it("keeps archived leagues when asked for them explicitly", async () => {
    membershipFindMany
      .mockResolvedValueOnce([
        membership("l-pl", "PL"),
        membership("l-wc", "WC", { archived: true }),
      ] as never)
      .mockResolvedValueOnce([{ leagueId: "l-pl", userId: "u1" }] as never)

    const ctx = await resolvePeerContext("u1", { includeArchived: true })

    expect(ctx?.competitionIds.sort()).toEqual(["PL", "WC"])
    expect(ctx?.myLeagueIds.sort()).toEqual(["l-pl", "l-wc"])
  })

  it("distinguishes 'all my leagues are finished' from 'I have no leagues'", async () => {
    membershipFindMany
      .mockResolvedValueOnce([membership("l-wc", "WC", { archived: true })] as never)
      .mockResolvedValueOnce([] as never)

    const ctx = await resolvePeerContext("u1")

    // Not null — the pages need to tell these apart to show the right empty state.
    expect(ctx).not.toBeNull()
    expect(ctx?.competitionIds).toEqual([])
    expect(ctx?.archivedMemberships).toHaveLength(1)
  })
})
