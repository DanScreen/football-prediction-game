import { describe, it, expect, vi, beforeEach } from "vitest"
import { resolveActiveLeagueId } from "./activeLeague"
import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leagueMembership: { findUnique: vi.fn(), findFirst: vi.fn() },
  },
}))
vi.mock("next/headers", () => ({ cookies: vi.fn() }))

const cookiesMock = vi.mocked(cookies)
const findUnique = vi.mocked(prisma.leagueMembership.findUnique)
const findFirst = vi.mocked(prisma.leagueMembership.findFirst)

/** Stub the cookie store with a single optional activeLeagueId value. */
function withCookie(value?: string) {
  cookiesMock.mockResolvedValue({
    get: (name: string) =>
      name === "activeLeagueId" && value ? { name, value } : undefined,
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("resolveActiveLeagueId", () => {
  it("uses the cookie when the user is still a member", async () => {
    withCookie("league-a")
    findUnique.mockResolvedValue({ leagueId: "league-a" } as never)

    expect(await resolveActiveLeagueId("u1")).toBe("league-a")
    expect(findFirst).not.toHaveBeenCalled()
  })

  // The bug this function exists for: the cookie is only written when a user
  // creates, joins or switches a league, so a fresh sign-in has none — and every
  // page redirected to /leagues, making the whole app look unnavigable.
  it("falls back to the first league when there is no cookie", async () => {
    withCookie(undefined)
    findFirst.mockResolvedValue({ leagueId: "league-a" } as never)

    expect(await resolveActiveLeagueId("u1")).toBe("league-a")
    expect(findUnique).not.toHaveBeenCalled()
  })

  it("falls back when the cookie points at a league the user has left", async () => {
    withCookie("stale-league")
    findUnique.mockResolvedValue(null as never)
    findFirst.mockResolvedValue({ leagueId: "league-b" } as never)

    expect(await resolveActiveLeagueId("u1")).toBe("league-b")
  })

  it("returns null when the user belongs to no leagues", async () => {
    withCookie(undefined)
    findFirst.mockResolvedValue(null as never)

    expect(await resolveActiveLeagueId("u1")).toBeNull()
  })

  it("scopes the membership lookup to the requesting user", async () => {
    withCookie("league-a")
    findUnique.mockResolvedValue({ leagueId: "league-a" } as never)

    await resolveActiveLeagueId("u1")

    expect(findUnique).toHaveBeenCalledWith({
      where: { userId_leagueId: { userId: "u1", leagueId: "league-a" } },
      select: { leagueId: true },
    })
  })
})
