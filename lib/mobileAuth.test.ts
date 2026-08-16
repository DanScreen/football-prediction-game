import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  signMobileAccessToken,
  verifyMobileAccessToken,
  authenticateMobileAccess,
  issueMobileRefreshToken,
  rotateMobileRefreshToken,
  revokeMobileRefreshToken,
  MOBILE_ACCESS_TTL_SECONDS,
} from "./mobileAuth"
import { prisma } from "@/lib/prisma"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    mobileRefreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

const userFindUnique = vi.mocked(prisma.user.findUnique)
const refreshCreate = vi.mocked(prisma.mobileRefreshToken.create)
const refreshFindUnique = vi.mocked(prisma.mobileRefreshToken.findUnique)
const refreshUpdate = vi.mocked(prisma.mobileRefreshToken.update)
const refreshUpdateMany = vi.mocked(prisma.mobileRefreshToken.updateMany)
const transaction = vi.mocked(prisma.$transaction)

beforeEach(() => {
  vi.clearAllMocks()
  process.env.AUTH_SECRET = "test-secret-for-mobile-jwt"
  transaction.mockImplementation(async (ops) => {
    // Execute the array of promises prisma.$transaction receives in production.
    return Promise.all(ops as Promise<unknown>[])
  })
})

afterEach(() => {
  delete process.env.AUTH_SECRET
})

describe("signMobileAccessToken / verifyMobileAccessToken", () => {
  it("round-trips a valid access token", () => {
    const token = signMobileAccessToken("user-1")
    expect(verifyMobileAccessToken(token)).toBe("user-1")
  })

  it("rejects a tampered payload", () => {
    const token = signMobileAccessToken("user-1")
    const [h, , s] = token.split(".")
    const badPayload = Buffer.from(
      JSON.stringify({ sub: "hacker", typ: "access", iat: 1, exp: 9999999999 }),
    ).toString("base64url")
    expect(verifyMobileAccessToken(`${h}.${badPayload}.${s}`)).toBeNull()
  })

  it("rejects an expired token", () => {
    const now = Math.floor(Date.now() / 1000)
    const token = signMobileAccessToken("user-1", now - MOBILE_ACCESS_TTL_SECONDS - 10)
    expect(verifyMobileAccessToken(token)).toBeNull()
  })

  it("rejects a non-access typ", () => {
    // Sign manually with typ refresh
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    )
    const now = Math.floor(Date.now() / 1000)
    const payload = Buffer.from(
      JSON.stringify({ sub: "user-1", typ: "refresh", iat: now, exp: now + 60 }),
    ).toString("base64url")
    const { createHmac } = require("node:crypto") as typeof import("node:crypto")
    const data = `${header}.${payload}`
    const sig = createHmac("sha256", "test-secret-for-mobile-jwt")
      .update(data)
      .digest("base64url")
    expect(verifyMobileAccessToken(`${data}.${sig}`)).toBeNull()
  })
})

describe("authenticateMobileAccess", () => {
  it("returns null without Bearer", async () => {
    expect(await authenticateMobileAccess(new Request("http://t"))).toBeNull()
  })

  it("returns the user for a valid access token", async () => {
    const token = signMobileAccessToken("u1")
    userFindUnique.mockResolvedValue({
      id: "u1",
      email: "a@b.c",
      displayName: "A",
      isBot: false,
    } as never)
    const user = await authenticateMobileAccess(
      new Request("http://t", { headers: { authorization: `Bearer ${token}` } }),
    )
    expect(user).toEqual({
      id: "u1",
      email: "a@b.c",
      displayName: "A",
      isBot: false,
    })
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { id: true, email: true, displayName: true, isBot: true },
    })
  })
})

describe("refresh token rotation", () => {
  it("issues a refresh token row hashed in the DB", async () => {
    refreshCreate.mockResolvedValue({ id: "r1" } as never)
    const raw = await issueMobileRefreshToken("u1")
    expect(raw.length).toBeGreaterThan(20)
    expect(refreshCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "u1",
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    })
    const hash = (refreshCreate.mock.calls[0]![0] as { data: { tokenHash: string } }).data
      .tokenHash
    expect(hash).not.toBe(raw)
  })

  it("rotates a valid refresh token", async () => {
    refreshFindUnique.mockResolvedValue({
      id: "r1",
      userId: "u1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    } as never)
    refreshUpdate.mockResolvedValue({} as never)
    refreshCreate.mockResolvedValue({} as never)

    const result = await rotateMobileRefreshToken("raw-token-value")
    expect(result).not.toBeNull()
    expect(result!.userId).toBe("u1")
    expect(result!.accessToken).toBeTruthy()
    expect(result!.refreshToken).toBeTruthy()
    expect(verifyMobileAccessToken(result!.accessToken)).toBe("u1")
  })

  it("returns null for an expired refresh token", async () => {
    refreshFindUnique.mockResolvedValue({
      id: "r1",
      userId: "u1",
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    } as never)
    expect(await rotateMobileRefreshToken("old")).toBeNull()
  })

  it("revokes by raw token", async () => {
    refreshUpdateMany.mockResolvedValue({ count: 1 } as never)
    await revokeMobileRefreshToken("raw")
    expect(refreshUpdateMany).toHaveBeenCalledWith({
      where: { tokenHash: expect.any(String), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
  })
})
