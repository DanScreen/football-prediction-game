import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST as join } from "./route"
import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    league: { findUnique: vi.fn() },
    leagueMembership: { findUnique: vi.fn(), create: vi.fn() },
  },
}))
vi.mock("@/lib/mobileAuth", () => ({
  authenticateMobileAccess: vi.fn(),
}))

const authMock = vi.mocked(authenticateMobileAccess)
const leagueFindUnique = vi.mocked(prisma.league.findUnique)
const membershipFindUnique = vi.mocked(prisma.leagueMembership.findUnique)
const membershipCreate = vi.mocked(prisma.leagueMembership.create)

function post(body: unknown) {
  return new Request("http://test/api/mobile/v1/leagues/join", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({
    id: "u1",
    email: "a@b.c",
    displayName: "A",
    isBot: false,
  })
})

describe("POST /api/mobile/v1/leagues/join", () => {
  it("404s for unknown invite", async () => {
    leagueFindUnique.mockResolvedValue(null)
    const res = await join(post({ inviteCode: "XXXXXX" }))
    expect(res.status).toBe(404)
  })

  it("409s when already a member", async () => {
    leagueFindUnique.mockResolvedValue({
      id: "l1",
      name: "L",
      inviteCode: "ABCDEF",
      competitionId: "c1",
      competition: { name: "PL" },
    } as never)
    membershipFindUnique.mockResolvedValue({ id: "m1" } as never)
    const res = await join(post({ inviteCode: "abcdef" }))
    expect(res.status).toBe(409)
    expect(membershipCreate).not.toHaveBeenCalled()
  })

  it("joins and returns 201", async () => {
    leagueFindUnique.mockResolvedValue({
      id: "l1",
      name: "L",
      inviteCode: "ABCDEF",
      competitionId: "c1",
      competition: { name: "PL" },
    } as never)
    membershipFindUnique.mockResolvedValue(null)
    membershipCreate.mockResolvedValue({} as never)
    const res = await join(post({ inviteCode: "abcdef" }))
    expect(res.status).toBe(201)
    expect(membershipCreate).toHaveBeenCalledWith({
      data: { userId: "u1", leagueId: "l1", role: "MEMBER" },
    })
  })
})
