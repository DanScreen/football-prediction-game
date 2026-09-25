import { describe, it, expect, vi, beforeEach } from "vitest"
import { listHostUsers, parseHostUserFilter, HOST_USERS_PAGE_SIZE } from "./hostUsers"
import { prisma } from "@/lib/prisma"

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { count: vi.fn(), findMany: vi.fn() } },
}))

const userCount = vi.mocked(prisma.user.count)
const userFindMany = vi.mocked(prisma.user.findMany)

function counts(total: number, all = 10, unverified = 4, verified = 5) {
  userCount
    .mockResolvedValueOnce(total)
    .mockResolvedValueOnce(all)
    .mockResolvedValueOnce(unverified)
    .mockResolvedValueOnce(verified)
}

beforeEach(() => {
  vi.resetAllMocks()
  userFindMany.mockResolvedValue([])
})

describe("parseHostUserFilter", () => {
  it("accepts the known filters and falls back to all", () => {
    expect(parseHostUserFilter("unverified")).toBe("unverified")
    expect(parseHostUserFilter("verified")).toBe("verified")
    expect(parseHostUserFilter("nonsense")).toBe("all")
    expect(parseHostUserFilter(undefined)).toBe("all")
  })
})

describe("listHostUsers", () => {
  it("flattens the latest link times and league count onto each row", async () => {
    counts(1)
    const sent = new Date("2026-09-25T10:00:00Z")
    const reset = new Date("2026-09-24T10:00:00Z")
    userFindMany.mockResolvedValue([
      {
        id: "u1",
        displayName: "Alice",
        email: "alice@test.com",
        isBot: false,
        isSiteAdmin: false,
        createdAt: new Date(),
        lastSeenAt: null,
        emailVerifiedAt: null,
        emailVerificationTokens: [{ createdAt: sent }],
        resetTokens: [{ createdAt: reset }],
        _count: { memberships: 2 },
      },
    ] as never)

    const result = await listHostUsers({})

    expect(result.users[0]).toMatchObject({
      id: "u1",
      lastVerificationSentAt: sent,
      lastResetSentAt: reset,
      leagueCount: 2,
    })
    expect(result.counts).toEqual({ all: 10, unverified: 4, verified: 5 })
  })

  it("lists only unverified humans under the unverified filter", async () => {
    counts(0)
    await listHostUsers({ filter: "unverified" })
    expect(userFindMany.mock.calls[0][0]).toMatchObject({
      where: { isBot: false, emailVerifiedAt: null },
    })
  })

  it("searches name and email case-insensitively", async () => {
    counts(0)
    await listHostUsers({ query: "  Ali  " })
    expect(userFindMany.mock.calls[0][0]!.where).toMatchObject({
      OR: [
        { displayName: { contains: "Ali", mode: "insensitive" } },
        { email: { contains: "Ali", mode: "insensitive" } },
      ],
    })
  })

  it("clamps the page into range", async () => {
    counts(HOST_USERS_PAGE_SIZE + 1)
    const result = await listHostUsers({ page: 99 })
    expect(result.page).toBe(2)
    expect(result.totalPages).toBe(2)
    expect(userFindMany.mock.calls[0][0]).toMatchObject({ skip: HOST_USERS_PAGE_SIZE })
  })

  it("treats a junk page number as page 1", async () => {
    counts(3)
    expect((await listHostUsers({ page: Number.NaN })).page).toBe(1)
  })
})
