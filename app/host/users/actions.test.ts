import { describe, it, expect, vi, beforeEach } from "vitest"
import { fixUnverifiedEmail, sendResetLink, sendVerificationLink } from "./actions"
import { requireSiteAdmin } from "@/lib/adminAuth"
import { prisma } from "@/lib/prisma"
import { changeUnverifiedEmail, sendVerificationEmail } from "@/lib/emailVerification"
import { sendPasswordResetEmail } from "@/lib/passwordReset"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/adminAuth", () => ({ requireSiteAdmin: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }))
vi.mock("@/lib/emailVerification", () => ({
  sendVerificationEmail: vi.fn(),
  changeUnverifiedEmail: vi.fn(),
}))
vi.mock("@/lib/passwordReset", () => ({ sendPasswordResetEmail: vi.fn() }))

const requireHost = vi.mocked(requireSiteAdmin)
const findUser = vi.mocked(prisma.user.findUnique)
const sendVerify = vi.mocked(sendVerificationEmail)
const sendReset = vi.mocked(sendPasswordResetEmail)
const changeEmail = vi.mocked(changeUnverifiedEmail)

const alice = { id: "u1", email: "alice@test.com", isBot: false }

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, "info").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
  requireHost.mockResolvedValue({ userId: "host" })
  findUser.mockResolvedValue(alice as never)
})

describe("host user actions", () => {
  it("refuse anyone who isn't a site host", async () => {
    requireHost.mockRejectedValue(new Error("Unauthorised"))
    await expect(sendVerificationLink("u1")).rejects.toThrow("Unauthorised")
    await expect(sendResetLink("u1")).rejects.toThrow("Unauthorised")
    await expect(fixUnverifiedEmail("u1", "a@b.co")).rejects.toThrow("Unauthorised")
    expect(sendVerify).not.toHaveBeenCalled()
    expect(sendReset).not.toHaveBeenCalled()
    expect(changeEmail).not.toHaveBeenCalled()
  })

  it("won't email a bot", async () => {
    findUser.mockResolvedValue({ ...alice, isBot: true } as never)
    expect((await sendResetLink("u1")).error).toMatch(/bot/i)
    expect(sendReset).not.toHaveBeenCalled()
  })

  it("reports an unknown user", async () => {
    findUser.mockResolvedValue(null)
    expect((await sendVerificationLink("nope")).error).toBe("User not found.")
  })
})

describe("sendVerificationLink", () => {
  it("sends and confirms the address", async () => {
    sendVerify.mockResolvedValue({ status: "sent" })
    expect(await sendVerificationLink("u1")).toEqual({
      message: "Verification link sent to alice@test.com.",
    })
  })

  it("explains the cooldown", async () => {
    sendVerify.mockResolvedValue({ status: "cooldown", retryInSeconds: 42 })
    expect((await sendVerificationLink("u1")).error).toMatch(/42s/)
  })

  it("says when the user is already verified", async () => {
    sendVerify.mockResolvedValue({ status: "already-verified" })
    expect((await sendVerificationLink("u1")).error).toMatch(/already verified/i)
  })

  it("turns a send failure into a message", async () => {
    sendVerify.mockRejectedValue(new Error("Resend down"))
    expect((await sendVerificationLink("u1")).error).toMatch(/couldn't be sent/)
  })
})

describe("sendResetLink", () => {
  it("sends and confirms the address", async () => {
    sendReset.mockResolvedValue({ status: "sent" })
    expect(await sendResetLink("u1")).toEqual({ message: "Reset link sent to alice@test.com." })
  })

  it("explains the cooldown in minutes", async () => {
    sendReset.mockResolvedValue({ status: "cooldown", retryInSeconds: 170 })
    expect((await sendResetLink("u1")).error).toMatch(/3 min/)
  })
})

describe("fixUnverifiedEmail", () => {
  it("updates the address and reports the new link", async () => {
    changeEmail.mockResolvedValue({ email: "alice@real.com" })
    expect(await fixUnverifiedEmail("u1", "alice@real.com")).toEqual({
      message: "Updated to alice@real.com and sent a verification link.",
    })
    expect(changeEmail).toHaveBeenCalledWith("u1", "alice@real.com")
  })

  it("passes on a refusal", async () => {
    changeEmail.mockResolvedValue({ error: "An account with that email already exists." })
    expect((await fixUnverifiedEmail("u1", "taken@b.co")).error).toMatch(/already exists/)
  })
})
