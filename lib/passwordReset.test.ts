import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { requestPasswordReset, isResetTokenValid, resetPassword } from "./passwordReset"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    passwordResetToken: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
}))

const userFindUnique = vi.mocked(prisma.user.findUnique)
const userUpdate = vi.mocked(prisma.user.update)
const userUpdateMany = vi.mocked(prisma.user.updateMany)
const tokenFindFirst = vi.mocked(prisma.passwordResetToken.findFirst)
const tokenFindUnique = vi.mocked(prisma.passwordResetToken.findUnique)
const tokenCreate = vi.mocked(prisma.passwordResetToken.create)
const tokenUpdateMany = vi.mocked(prisma.passwordResetToken.updateMany)
const transaction = vi.mocked(prisma.$transaction)
const sendEmailMock = vi.mocked(sendEmail)

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("AUTH_URL", "https://example.com")
  transaction.mockImplementation((ops: unknown[]) => Promise.all(ops) as never)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("requestPasswordReset", () => {
  it("does nothing for an unknown email", async () => {
    userFindUnique.mockResolvedValue(null)
    await requestPasswordReset("nobody@test.com")
    expect(tokenCreate).not.toHaveBeenCalled()
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it("creates a token and emails the link for a known user", async () => {
    userFindUnique.mockResolvedValue({ id: "u1", email: "alice@test.com", displayName: "Alice" } as never)
    tokenFindFirst.mockResolvedValue(null)

    await requestPasswordReset("alice@test.com")

    expect(tokenCreate).toHaveBeenCalledTimes(1)
    expect(tokenCreate.mock.calls[0][0]).toMatchObject({ data: { userId: "u1" } })
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    const emailArg = sendEmailMock.mock.calls[0][0]
    expect(emailArg.to).toBe("alice@test.com")
    expect(emailArg.html).toContain("https://example.com/reset-password/")
  })

  it("skips issuing a second token within the cooldown window", async () => {
    userFindUnique.mockResolvedValue({ id: "u1", email: "alice@test.com", displayName: "Alice" } as never)
    tokenFindFirst.mockResolvedValue({ id: "t1" } as never)

    await requestPasswordReset("alice@test.com")

    expect(tokenCreate).not.toHaveBeenCalled()
    expect(sendEmailMock).not.toHaveBeenCalled()
  })
})

describe("isResetTokenValid", () => {
  it("is false when no token matches", async () => {
    tokenFindUnique.mockResolvedValue(null)
    expect(await isResetTokenValid("abc")).toBe(false)
  })

  it("is false when the token is expired", async () => {
    tokenFindUnique.mockResolvedValue({ usedAt: null, expiresAt: new Date(Date.now() - 1000) } as never)
    expect(await isResetTokenValid("abc")).toBe(false)
  })

  it("is false when the token was already used", async () => {
    tokenFindUnique.mockResolvedValue({
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
    } as never)
    expect(await isResetTokenValid("abc")).toBe(false)
  })

  it("is true for a fresh, unused token", async () => {
    tokenFindUnique.mockResolvedValue({ usedAt: null, expiresAt: new Date(Date.now() + 1000) } as never)
    expect(await isResetTokenValid("abc")).toBe(true)
  })
})

describe("resetPassword", () => {
  it("rejects an unknown token", async () => {
    tokenFindUnique.mockResolvedValue(null)
    const result = await resetPassword("bad-token", "newpassword1")
    expect(result.error).toMatch(/invalid or has expired/)
    expect(transaction).not.toHaveBeenCalled()
  })

  it("rejects an expired token", async () => {
    tokenFindUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    } as never)
    const result = await resetPassword("expired-token", "newpassword1")
    expect(result.error).toMatch(/invalid or has expired/)
    expect(transaction).not.toHaveBeenCalled()
  })

  it("rejects an already-used token", async () => {
    tokenFindUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
    } as never)
    const result = await resetPassword("used-token", "newpassword1")
    expect(result.error).toMatch(/invalid or has expired/)
    expect(transaction).not.toHaveBeenCalled()
  })

  it("updates the password hash and invalidates outstanding tokens for a valid token", async () => {
    tokenFindUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      usedAt: null,
      expiresAt: new Date(Date.now() + 1000),
    } as never)

    const result = await resetPassword("good-token", "newpassword1")

    expect(result.error).toBeUndefined()
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { passwordHash: expect.stringMatching(/^\$2/) },
    })
    expect(tokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: "u1", usedAt: null },
      data: { usedAt: expect.any(Date) },
    })
  })

  it("marks an unverified email as verified, since the link proved the mailbox", async () => {
    tokenFindUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      usedAt: null,
      expiresAt: new Date(Date.now() + 1000),
    } as never)

    await resetPassword("good-token", "newpassword1")

    expect(userUpdateMany).toHaveBeenCalledWith({
      where: { id: "u1", emailVerifiedAt: null },
      data: { emailVerifiedAt: expect.any(Date) },
    })
  })
})
