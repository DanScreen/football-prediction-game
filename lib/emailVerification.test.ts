import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import crypto from "node:crypto"
import {
  sendVerificationEmail,
  ensureVerificationEmailSent,
  verifyEmailToken,
  changeUnverifiedEmail,
  isEmailVerified,
  RESEND_COOLDOWN_MS,
} from "./emailVerification"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    emailVerificationToken: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    passwordResetToken: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
}))

const userFindUnique = vi.mocked(prisma.user.findUnique)
const userUpdate = vi.mocked(prisma.user.update)
const tokenFindFirst = vi.mocked(prisma.emailVerificationToken.findFirst)
const tokenFindUnique = vi.mocked(prisma.emailVerificationToken.findUnique)
const tokenCreate = vi.mocked(prisma.emailVerificationToken.create)
const tokenDelete = vi.mocked(prisma.emailVerificationToken.delete)
const tokenUpdateMany = vi.mocked(prisma.emailVerificationToken.updateMany)
const tokenDeleteMany = vi.mocked(prisma.emailVerificationToken.deleteMany)
const resetUpdateMany = vi.mocked(prisma.passwordResetToken.updateMany)
const transaction = vi.mocked(prisma.$transaction)
const sendEmailMock = vi.mocked(sendEmail)

const unverified = {
  id: "u1",
  email: "alice@test.com",
  displayName: "Alice <b>",
  emailVerifiedAt: null,
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("AUTH_URL", "https://example.com")
  transaction.mockImplementation(((ops: unknown[]) => Promise.all(ops)) as never)
  tokenCreate.mockResolvedValue({ id: "t1" } as never)
  tokenDelete.mockResolvedValue({} as never)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("sendVerificationEmail", () => {
  it("creates a token pinned to the current address and emails the link", async () => {
    userFindUnique.mockResolvedValue(unverified as never)
    tokenFindFirst.mockResolvedValue(null)

    expect(await sendVerificationEmail("u1")).toEqual({ status: "sent" })

    expect(tokenCreate.mock.calls[0][0]).toMatchObject({
      data: { userId: "u1", email: "alice@test.com" },
    })
    const { tokenHash } = tokenCreate.mock.calls[0][0].data as { tokenHash: string }
    const email = sendEmailMock.mock.calls[0][0]
    expect(email.to).toBe("alice@test.com")
    const raw = email.html.match(/verify-email\/([a-f0-9]{64})/)![1]
    // Only the hash is stored, never the raw token in the link
    expect(tokenHash).toBe(crypto.createHash("sha256").update(raw).digest("hex"))
    expect(email.html).toContain("https://example.com/verify-email/")
    // The display name is user-supplied, so it is escaped in the HTML body
    expect(email.html).toContain("Alice &lt;b&gt;")
  })

  it("does nothing for an already verified account", async () => {
    userFindUnique.mockResolvedValue({ ...unverified, emailVerifiedAt: new Date() } as never)
    expect(await sendVerificationEmail("u1")).toEqual({ status: "already-verified" })
    expect(tokenCreate).not.toHaveBeenCalled()
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("refuses to resend inside the cooldown and says how long to wait", async () => {
    userFindUnique.mockResolvedValue(unverified as never)
    tokenFindFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - RESEND_COOLDOWN_MS + 20_000),
    } as never)

    const result = await sendVerificationEmail("u1")

    expect(result.status).toBe("cooldown")
    expect(result.status === "cooldown" && result.retryInSeconds).toBeGreaterThan(15)
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("propagates a send failure and drops the unsent token", async () => {
    userFindUnique.mockResolvedValue(unverified as never)
    tokenFindFirst.mockResolvedValue(null)
    sendEmailMock.mockRejectedValue(new Error("Resend down"))
    await expect(sendVerificationEmail("u1")).rejects.toThrow("Resend down")
    // Otherwise the page would say "we sent a link" and the retry would be in cooldown
    expect(tokenDelete).toHaveBeenCalledWith({ where: { id: "t1" } })
  })
})

describe("ensureVerificationEmailSent", () => {
  it("sends a link to an account that has never been sent one", async () => {
    userFindUnique.mockResolvedValue(unverified as never)
    tokenFindFirst.mockResolvedValue(null)

    expect(await ensureVerificationEmailSent("u1")).toBe(true)
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    expect(sendEmailMock.mock.calls[0][0].to).toBe("alice@test.com")
  })

  it("leaves a live link to the current address alone", async () => {
    userFindUnique.mockResolvedValue(unverified as never)
    tokenFindFirst.mockResolvedValueOnce({ id: "t0" } as never)

    expect(await ensureVerificationEmailSent("u1")).toBe(true)
    expect(tokenFindFirst.mock.calls[0][0]).toMatchObject({
      where: { userId: "u1", email: "alice@test.com", usedAt: null },
    })
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("does nothing for a verified account", async () => {
    userFindUnique.mockResolvedValue({ ...unverified, emailVerifiedAt: new Date() } as never)
    expect(await ensureVerificationEmailSent("u1")).toBe(false)
    expect(tokenFindFirst).not.toHaveBeenCalled()
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("reports a failed send instead of throwing", async () => {
    userFindUnique.mockResolvedValue(unverified as never)
    tokenFindFirst.mockResolvedValue(null)
    sendEmailMock.mockRejectedValue(new Error("Resend down"))
    vi.spyOn(console, "error").mockImplementation(() => {})

    expect(await ensureVerificationEmailSent("u1")).toBe(false)
  })
})

describe("verifyEmailToken", () => {
  const record = (over: Record<string, unknown> = {}) => ({
    userId: "u1",
    email: "alice@test.com",
    usedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    user: { email: "alice@test.com", emailVerifiedAt: null },
    ...over,
  })

  it("verifies the user and consumes every outstanding token", async () => {
    tokenFindUnique.mockResolvedValue(record() as never)

    expect(await verifyEmailToken("raw")).toBe("verified")
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { emailVerifiedAt: expect.any(Date) },
    })
    expect(tokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: "u1", usedAt: null },
      data: { usedAt: expect.any(Date) },
    })
  })

  it("rejects an unknown token", async () => {
    tokenFindUnique.mockResolvedValue(null)
    expect(await verifyEmailToken("raw")).toBe("invalid")
    expect(transaction).not.toHaveBeenCalled()
  })

  it("rejects an empty token without a lookup", async () => {
    expect(await verifyEmailToken("")).toBe("invalid")
    expect(tokenFindUnique).not.toHaveBeenCalled()
  })

  it("rejects an expired token", async () => {
    tokenFindUnique.mockResolvedValue(record({ expiresAt: new Date(Date.now() - 1) }) as never)
    expect(await verifyEmailToken("raw")).toBe("invalid")
    expect(transaction).not.toHaveBeenCalled()
  })

  it("rejects a link sent to an address the user has since changed", async () => {
    tokenFindUnique.mockResolvedValue(
      record({ user: { email: "new@test.com", emailVerifiedAt: null } }) as never,
    )
    expect(await verifyEmailToken("raw")).toBe("invalid")
    expect(transaction).not.toHaveBeenCalled()
  })

  it("reports success for a used link when the address is verified (mail scanners)", async () => {
    tokenFindUnique.mockResolvedValue(
      record({
        usedAt: new Date(),
        user: { email: "alice@test.com", emailVerifiedAt: new Date() },
      }) as never,
    )
    expect(await verifyEmailToken("raw")).toBe("verified")
    expect(transaction).not.toHaveBeenCalled()
  })
})

describe("changeUnverifiedEmail", () => {
  it("rejects a malformed address before touching the DB", async () => {
    const result = await changeUnverifiedEmail("u1", "not-an-email")
    expect(result.error).toMatch(/valid email/)
    expect(userFindUnique).not.toHaveBeenCalled()
  })

  it("refuses once the account is verified", async () => {
    userFindUnique.mockResolvedValueOnce({ ...unverified, emailVerifiedAt: new Date() } as never)
    const result = await changeUnverifiedEmail("u1", "new@test.com")
    expect(result.error).toMatch(/already verified/)
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it("refuses an address another account uses", async () => {
    userFindUnique
      .mockResolvedValueOnce(unverified as never)
      .mockResolvedValueOnce({ id: "u2" } as never)
    const result = await changeUnverifiedEmail("u1", "taken@test.com")
    expect(result.error).toMatch(/already exists/)
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it("updates the address, kills old links (verification and reset), and sends a new one", async () => {
    userFindUnique
      .mockResolvedValueOnce(unverified as never) // the account
      .mockResolvedValueOnce(null) // nobody else has the address
      .mockResolvedValueOnce({ ...unverified, email: "new@test.com" } as never) // resend reads it
    tokenFindFirst.mockResolvedValue(null)

    const result = await changeUnverifiedEmail("u1", "  New@Test.com ")

    expect(result).toEqual({ email: "new@test.com" })
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: "u1" }, data: { email: "new@test.com" } })
    expect(tokenDeleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } })
    expect(resetUpdateMany).toHaveBeenCalledWith({
      where: { userId: "u1", usedAt: null },
      data: { usedAt: expect.any(Date) },
    })
    expect(sendEmailMock.mock.calls[0][0].to).toBe("new@test.com")
  })

  it("keeps the change but reports it when the email can't be sent", async () => {
    userFindUnique
      .mockResolvedValueOnce(unverified as never)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...unverified, email: "new@test.com" } as never)
    tokenFindFirst.mockResolvedValue(null)
    sendEmailMock.mockRejectedValue(new Error("Resend down"))
    vi.spyOn(console, "error").mockImplementation(() => {})

    const result = await changeUnverifiedEmail("u1", "new@test.com")

    expect(userUpdate).toHaveBeenCalled()
    expect(result.email).toBe("new@test.com")
    expect(result.error).toMatch(/couldn't send/)
  })
})

describe("isEmailVerified", () => {
  it("reads the flag fresh from the DB", async () => {
    userFindUnique.mockResolvedValue({ emailVerifiedAt: new Date() } as never)
    expect(await isEmailVerified("u1")).toBe(true)
    userFindUnique.mockResolvedValue({ emailVerifiedAt: null } as never)
    expect(await isEmailVerified("u1")).toBe(false)
    userFindUnique.mockResolvedValue(null)
    expect(await isEmailVerified("gone")).toBe(false)
  })
})
