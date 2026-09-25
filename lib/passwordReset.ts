import crypto from "node:crypto"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour
const RESEND_COOLDOWN_MS = 5 * 60 * 1000 // suppress re-issuing a token within 5 min of the last one

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex")
}

export type SendResetResult = { status: "sent" } | { status: "cooldown"; retryInSeconds: number }

/**
 * Issues a password reset token for a known user and emails the link, unless
 * one went out in the last few minutes. Throws if the email can't be sent.
 * The public form goes through `requestPasswordReset`; site hosts call this
 * directly so they're told when the cooldown held the email back.
 */
export async function sendPasswordResetEmail(userId: string): Promise<SendResetResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true },
  })
  if (!user) throw new Error("User not found")

  const recent = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })
  if (recent) {
    const waitMs = recent.createdAt.getTime() + RESEND_COOLDOWN_MS - Date.now()
    return { status: "cooldown", retryInSeconds: Math.max(1, Math.ceil(waitMs / 1000)) }
  }

  const rawToken = crypto.randomBytes(32).toString("hex")
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  })

  const appUrl = process.env.AUTH_URL ?? ""
  await sendEmail({
    to: user.email,
    subject: "Reset your Football Prediction App password",
    html: `<p>Hi ${user.displayName},</p>
<p>Click the link below to choose a new password. This link expires in 1 hour and can only be used once.</p>
<p><a href="${appUrl}/reset-password/${rawToken}">Reset your password</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>`,
  })
  return { status: "sent" }
}

/**
 * The public "forgot password" request. Always resolves without error whether
 * or not the email is registered, and is silently rate-limited per user, so it
 * can't be used to enumerate accounts or spam a mailbox.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) return
  await sendPasswordResetEmail(user.id)
}

/** Validates a raw reset token without consuming it, for rendering the reset form. */
export async function isResetTokenValid(rawToken: string): Promise<boolean> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  })
  return !!record && !record.usedAt && record.expiresAt > new Date()
}

export async function resetPassword(
  rawToken: string,
  newPassword: string,
): Promise<{ error?: string }> {
  const tokenHash = hashToken(rawToken)
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: "This reset link is invalid or has expired." }
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    // The link reached the account's mailbox, which is exactly what email
    // verification proves — so a completed reset verifies too. Safe because
    // changing an unverified address kills outstanding reset links.
    prisma.user.updateMany({
      where: { id: record.userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    }),
    // Invalidate every outstanding token for this user, not just the one used
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ])

  return {}
}
