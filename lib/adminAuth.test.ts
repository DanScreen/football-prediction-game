import { describe, it, expect, vi, beforeEach } from "vitest"
import { requireSiteAdmin } from "./adminAuth"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

vi.mock("@/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    leagueMembership: { findUnique: vi.fn() },
  },
}))
vi.mock("next/headers", () => ({ cookies: vi.fn() }))

const authMock = vi.mocked(auth)
const userFindUnique = vi.mocked(prisma.user.findUnique)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("requireSiteAdmin", () => {
  it("throws when there is no session", async () => {
    authMock.mockResolvedValue(null as never)
    await expect(requireSiteAdmin()).rejects.toThrow("Unauthorised")
    expect(userFindUnique).not.toHaveBeenCalled()
  })

  it("throws when the user is not a site admin", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never)
    userFindUnique.mockResolvedValue({ isSiteAdmin: false } as never)
    await expect(requireSiteAdmin()).rejects.toThrow("Unauthorised")
  })

  it("re-checks the database rather than trusting the session", async () => {
    // Session claims admin (stale JWT), DB says revoked
    authMock.mockResolvedValue({ user: { id: "u1", isSiteAdmin: true } } as never)
    userFindUnique.mockResolvedValue({ isSiteAdmin: false } as never)
    await expect(requireSiteAdmin()).rejects.toThrow("Unauthorised")
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { isSiteAdmin: true },
    })
  })

  it("returns the userId for a site admin", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } } as never)
    userFindUnique.mockResolvedValue({ isSiteAdmin: true } as never)
    await expect(requireSiteAdmin()).resolves.toEqual({ userId: "u1" })
  })
})
