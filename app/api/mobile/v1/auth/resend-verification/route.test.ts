import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "./route"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { sendVerificationEmail } from "@/lib/emailVerification"

vi.mock("@/lib/mobileAuth", () => ({ authenticateMobileAccess: vi.fn() }))
vi.mock("@/lib/emailVerification", () => ({ sendVerificationEmail: vi.fn() }))

const authMock = vi.mocked(authenticateMobileAccess)
const sendMock = vi.mocked(sendVerificationEmail)

const req = () => new Request("http://t/api/mobile/v1/auth/resend-verification", { method: "POST" })

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({
    id: "u1",
    email: "a@b.co",
    displayName: "A",
    isBot: false,
    emailVerified: false,
    avatarUrl: null,
  })
})

describe("POST /api/mobile/v1/auth/resend-verification", () => {
  it("401s without access token", async () => {
    authMock.mockResolvedValue(null)
    expect((await POST(req())).status).toBe(401)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("sends for an unverified user", async () => {
    sendMock.mockResolvedValue({ status: "sent" })
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: "sent" })
    expect(sendMock).toHaveBeenCalledWith("u1")
  })

  it("429s inside the cooldown with the wait", async () => {
    sendMock.mockResolvedValue({ status: "cooldown", retryInSeconds: 42 })
    const res = await POST(req())
    expect(res.status).toBe(429)
    expect(res.headers.get("retry-after")).toBe("42")
    expect((await res.json()).retryInSeconds).toBe(42)
  })

  it("502s when the email provider fails", async () => {
    sendMock.mockRejectedValue(new Error("down"))
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect((await POST(req())).status).toBe(502)
  })
})
