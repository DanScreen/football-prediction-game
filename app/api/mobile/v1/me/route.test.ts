import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET, PATCH } from "./route"
import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { changeUnverifiedEmail, ensureVerificationEmailSent } from "@/lib/emailVerification"

vi.mock("@/lib/prisma", () => ({
  prisma: { leagueMembership: { findMany: vi.fn() } },
}))
vi.mock("@/lib/mobileAuth", () => ({ authenticateMobileAccess: vi.fn() }))
vi.mock("@/lib/accountDeletion", () => ({ deleteUserAccount: vi.fn() }))
vi.mock("@/lib/emailVerification", () => ({
  changeUnverifiedEmail: vi.fn(),
  ensureVerificationEmailSent: vi.fn(),
}))

const authMock = vi.mocked(authenticateMobileAccess)
const changeMock = vi.mocked(changeUnverifiedEmail)
const ensureMock = vi.mocked(ensureVerificationEmailSent)

const unverified = {
  id: "u1",
  email: "a@b.co",
  displayName: "A",
  isBot: false,
  emailVerified: false,
  avatarUrl: null,
}

function patch(body: unknown) {
  return new Request("http://t/api/mobile/v1/me", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue(unverified)
  vi.mocked(prisma.leagueMembership.findMany).mockResolvedValue([])
})

describe("GET /api/mobile/v1/me", () => {
  it("answers an unverified user (it's how the app learns) and says so", async () => {
    const res = await GET(new Request("http://t/api/mobile/v1/me"))
    expect(res.status).toBe(200)
    expect((await res.json()).emailVerified).toBe(false)
  })

  it("makes sure an unverified user has a link in their inbox", async () => {
    await GET(new Request("http://t/api/mobile/v1/me"))
    expect(ensureMock).toHaveBeenCalledWith("u1")
  })

  it("doesn't touch email for a verified user", async () => {
    authMock.mockResolvedValue({ ...unverified, emailVerified: true })
    await GET(new Request("http://t/api/mobile/v1/me"))
    expect(ensureMock).not.toHaveBeenCalled()
  })
})

describe("PATCH /api/mobile/v1/me", () => {
  it("401s without access token", async () => {
    authMock.mockResolvedValue(null)
    expect((await PATCH(patch({ email: "x@y.co" }))).status).toBe(401)
  })

  it("changes the address and returns it", async () => {
    changeMock.mockResolvedValue({ email: "new@b.co" })
    const res = await PATCH(patch({ email: "New@b.co" }))
    expect(res.status).toBe(200)
    expect(changeMock).toHaveBeenCalledWith("u1", "New@b.co")
    expect(await res.json()).toEqual({ email: "new@b.co", emailVerified: false })
  })

  it("400s with the reason when the change is refused", async () => {
    changeMock.mockResolvedValue({ error: "An account with that email already exists." })
    const res = await PATCH(patch({ email: "taken@b.co" }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/already exists/)
  })

  it("reports a changed address with a warning when the link didn't send", async () => {
    changeMock.mockResolvedValue({ email: "new@b.co", error: "We updated your address but…" })
    const res = await PATCH(patch({ email: "new@b.co" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.email).toBe("new@b.co")
    expect(json.warning).toMatch(/updated your address/)
  })
})
