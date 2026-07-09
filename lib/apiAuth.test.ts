import { describe, it, expect, vi, beforeEach } from "vitest"
import { authenticateApiKey, resolveLeagueId, resolveLeague } from "./apiAuth"
import { prisma } from "@/lib/prisma"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    league: { findUnique: vi.fn() },
    leagueMembership: { findUnique: vi.fn(), findFirst: vi.fn() },
  },
}))

const userFindUnique = vi.mocked(prisma.user.findUnique)
const leagueFindUnique = vi.mocked(prisma.league.findUnique)
const membershipFindUnique = vi.mocked(prisma.leagueMembership.findUnique)
const membershipFindFirst = vi.mocked(prisma.leagueMembership.findFirst)

function requestWithAuth(header?: string) {
  return new Request("http://test/api/v1/fixtures", {
    headers: header ? { authorization: header } : {},
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("authenticateApiKey", () => {
  it("returns null without an Authorization header", async () => {
    expect(await authenticateApiKey(requestWithAuth())).toBeNull()
    expect(userFindUnique).not.toHaveBeenCalled()
  })

  it("returns null for non-Bearer schemes", async () => {
    expect(await authenticateApiKey(requestWithAuth("Basic abc123"))).toBeNull()
    expect(userFindUnique).not.toHaveBeenCalled()
  })

  it("returns null for an empty Bearer token", async () => {
    expect(await authenticateApiKey(requestWithAuth("Bearer   "))).toBeNull()
    expect(userFindUnique).not.toHaveBeenCalled()
  })

  it("looks up the user by trimmed key", async () => {
    const user = { id: "u1" }
    userFindUnique.mockResolvedValue(user as never)
    expect(await authenticateApiKey(requestWithAuth("Bearer  my-key "))).toBe(user)
    expect(userFindUnique).toHaveBeenCalledWith({ where: { apiKey: "my-key" } })
  })

  it("returns null when the key matches no user", async () => {
    userFindUnique.mockResolvedValue(null)
    expect(await authenticateApiKey(requestWithAuth("Bearer unknown"))).toBeNull()
  })
})

describe("resolveLeagueId", () => {
  it("returns the requested league when the user is a member", async () => {
    membershipFindUnique.mockResolvedValue({ id: "m1" } as never)
    expect(await resolveLeagueId("u1", "league-a")).toBe("league-a")
    expect(membershipFindUnique).toHaveBeenCalledWith({
      where: { userId_leagueId: { userId: "u1", leagueId: "league-a" } },
    })
  })

  it("returns null when the user is not a member of the requested league", async () => {
    membershipFindUnique.mockResolvedValue(null)
    expect(await resolveLeagueId("u1", "league-b")).toBeNull()
    expect(membershipFindFirst).not.toHaveBeenCalled()
  })

  it("falls back to the oldest membership when no league is requested", async () => {
    membershipFindFirst.mockResolvedValue({ leagueId: "league-first" } as never)
    expect(await resolveLeagueId("u1", null)).toBe("league-first")
    expect(membershipFindFirst).toHaveBeenCalledWith({
      where: { userId: "u1" },
      orderBy: { joinedAt: "asc" },
    })
  })

  it("returns null when the user has no memberships", async () => {
    membershipFindFirst.mockResolvedValue(null)
    expect(await resolveLeagueId("u1", null)).toBeNull()
  })
})

describe("resolveLeague", () => {
  it("returns the league id and competitionId", async () => {
    membershipFindUnique.mockResolvedValue({ id: "m1" } as never)
    leagueFindUnique.mockResolvedValue({ id: "league-a", competitionId: "comp-pl" } as never)

    expect(await resolveLeague("u1", "league-a")).toEqual({
      id: "league-a",
      competitionId: "comp-pl",
    })
    expect(leagueFindUnique).toHaveBeenCalledWith({
      where: { id: "league-a" },
      select: { id: true, competitionId: true },
    })
  })

  it("returns null when membership resolution fails", async () => {
    membershipFindUnique.mockResolvedValue(null)
    expect(await resolveLeague("u1", "league-b")).toBeNull()
    expect(leagueFindUnique).not.toHaveBeenCalled()
  })
})
