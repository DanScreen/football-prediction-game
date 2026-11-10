import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST as login } from "@/app/api/mobile/v1/auth/login/route"
import { POST as register } from "@/app/api/mobile/v1/auth/register/route"
import { POST as refresh } from "@/app/api/mobile/v1/auth/refresh/route"
import { prisma } from "@/lib/prisma"
import * as mobileAuth from "@/lib/mobileAuth"
import { sendVerificationEmail } from "@/lib/emailVerification"
import bcrypt from "bcryptjs"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    league: { findUnique: vi.fn() },
  },
}))
vi.mock("@/lib/lastSeen", () => ({
  touchLastSeen: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/mobileAuth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mobileAuth")>("@/lib/mobileAuth")
  return {
    ...actual,
    issueMobileTokenPair: vi.fn(),
    rotateMobileRefreshToken: vi.fn(),
  }
})

vi.mock("@/lib/emailVerification", () => ({
  sendVerificationEmail: vi.fn(),
}))

const userFindUnique = vi.mocked(prisma.user.findUnique)
const userCreate = vi.mocked(prisma.user.create)
const leagueFindUnique = vi.mocked(prisma.league.findUnique)
const issuePair = vi.mocked(mobileAuth.issueMobileTokenPair)
const rotate = vi.mocked(mobileAuth.rotateMobileRefreshToken)
const sendVerification = vi.mocked(sendVerificationEmail)

function post(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.AUTH_SECRET = "test-secret"
  issuePair.mockResolvedValue({ accessToken: "access", refreshToken: "refresh" })
})

describe("POST /api/mobile/v1/auth/login", () => {
  it("401s on bad password", async () => {
    const hash = await bcrypt.hash("right-password", 4)
    userFindUnique.mockResolvedValue({
      id: "u1",
      email: "a@b.c",
      displayName: "A",
      isBot: false,
      passwordHash: hash,
    } as never)
    const res = await login(post("http://t/login", { email: "a@b.c", password: "wrong" }))
    expect(res.status).toBe(401)
    expect(issuePair).not.toHaveBeenCalled()
  })

  it("returns tokens on success", async () => {
    const hash = await bcrypt.hash("secret12", 4)
    userFindUnique.mockResolvedValue({
      id: "u1",
      email: "a@b.c",
      displayName: "A",
      isBot: false,
      emailVerifiedAt: new Date(),
      passwordHash: hash,
    } as never)
    const res = await login(post("http://t/login", { email: " A@B.c ", password: "secret12" }))
    expect(res.status).toBe(200)
    expect(userFindUnique).toHaveBeenCalledWith({ where: { email: "a@b.c" } })
    const json = await res.json()
    expect(json).toEqual({
      user: {
        id: "u1",
        email: "a@b.c",
        displayName: "A",
        isBot: false,
        emailVerified: true,
        avatarUrl: null,
      },
      accessToken: "access",
      refreshToken: "refresh",
    })
  })
})

describe("POST /api/mobile/v1/auth/register", () => {
  it("400s when password is too short", async () => {
    const res = await register(
      post("http://t/register", {
        email: "a@b.co",
        password: "short",
        displayName: "A",
      }),
    )
    expect(res.status).toBe(400)
  })

  it("creates a user and returns 201 with tokens", async () => {
    userFindUnique.mockResolvedValue(null)
    leagueFindUnique.mockResolvedValue(null)
    userCreate.mockResolvedValue({
      id: "u1",
      email: "a@b.co",
      displayName: "A",
      isBot: false,
    } as never)
    const res = await register(
      post("http://t/register", {
        email: "a@b.co",
        password: "password1",
        displayName: "A",
        inviteCode: "BADCODE",
      }),
    )
    expect(res.status).toBe(201)
    expect(userCreate).toHaveBeenCalled()
    const json = await res.json()
    expect(json.accessToken).toBe("access")
    expect(json.user.email).toBe("a@b.co")
    expect(json.user.emailVerified).toBe(false)
    expect(sendVerification).toHaveBeenCalledWith("u1")
  })

  it.each(["not-an-email", "a@b", "a b@c.com", "a@b.c"])(
    "400s on a malformed email (%s) without creating anyone",
    async (email) => {
      const res = await register(
        post("http://t/register", { email, password: "password1", displayName: "A" }),
      )
      expect(res.status).toBe(400)
      expect((await res.json()).error).toMatch(/valid email/)
      expect(userCreate).not.toHaveBeenCalled()
    },
  )

  it("still signs the user up when the verification email fails", async () => {
    userFindUnique.mockResolvedValue(null)
    userCreate.mockResolvedValue({
      id: "u1",
      email: "a@b.co",
      displayName: "A",
      isBot: false,
      emailVerifiedAt: null,
    } as never)
    sendVerification.mockRejectedValue(new Error("Resend down"))
    vi.spyOn(console, "error").mockImplementation(() => {})
    const res = await register(
      post("http://t/register", { email: "a@b.co", password: "password1", displayName: "A" }),
    )
    expect(res.status).toBe(201)
  })

  it("joins a league when invite is valid", async () => {
    userFindUnique.mockResolvedValue(null)
    leagueFindUnique.mockResolvedValue({ id: "league-1" } as never)
    userCreate.mockResolvedValue({
      id: "u1",
      email: "a@b.co",
      displayName: "A",
      isBot: false,
    } as never)
    await register(
      post("http://t/register", {
        email: "a@b.co",
        password: "password1",
        displayName: "A",
        inviteCode: "abc123",
      }),
    )
    expect(userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          memberships: { create: { leagueId: "league-1", role: "MEMBER" } },
        }),
      }),
    )
  })
})

describe("POST /api/mobile/v1/auth/refresh", () => {
  it("401s when rotation fails", async () => {
    rotate.mockResolvedValue(null)
    const res = await refresh(post("http://t/refresh", { refreshToken: "dead" }))
    expect(res.status).toBe(401)
  })

  it("returns a new pair", async () => {
    rotate.mockResolvedValue({
      userId: "u1",
      accessToken: "a2",
      refreshToken: "r2",
    })
    const res = await refresh(post("http://t/refresh", { refreshToken: "r1" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ accessToken: "a2", refreshToken: "r2" })
  })
})
