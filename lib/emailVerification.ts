import crypto from "node:crypto"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { INVALID_EMAIL_MESSAGE, isValidEmail, normaliseEmail } from "@/lib/emailAddress"

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours — sign-up mail often sits unread for a while
/** Minimum gap between two verification emails to the same user. */
export const RESEND_COOLDOWN_MS = 60 * 1000

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex")
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export type SendVerificationResult =
  | { status: "sent" }
  | { status: "already-verified" }
  | { status: "cooldown"; retryInSeconds: number }

/**
 * Issues a single-use verification link for the user's current address and
 * emails it. Rate-limited per user so the resend button can't be used to spam a
 * mailbox. Throws if the email can't be sent (Resend unconfigured or failing) —
 * callers decide whether that blocks them.
 */
export async function sendVerificationEmail(userId: string): Promise<SendVerificationResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true, emailVerifiedAt: true },
  })
  if (!user) throw new Error("User not found")
  if (user.emailVerifiedAt) return { status: "already-verified" }

  const latest = await prisma.emailVerificationToken.findFirst({
    where: { userId, createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })
  if (latest) {
    const waitMs = latest.createdAt.getTime() + RESEND_COOLDOWN_MS - Date.now()
    return { status: "cooldown", retryInSeconds: Math.max(1, Math.ceil(waitMs / 1000)) }
  }

  const rawToken = crypto.randomBytes(32).toString("hex")
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      email: user.email,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  })

  const link = `${process.env.AUTH_URL ?? ""}/verify-email/${rawToken}`
  await sendEmail({
    to: user.email,
    subject: "Confirm your email for Scorers",
    html: `<p>Hi ${escapeHtml(user.displayName)},</p>
<p>Confirm this is your email address to finish setting up your Scorers account.</p>
<p><a href="${link}">Confirm my email address</a></p>
<p>The link works once and expires in 24 hours. If you didn't sign up for Scorers, you can ignore this email.</p>`,
  })

  return { status: "sent" }
}

export type VerifyTokenResult = "verified" | "invalid"

/**
 * Consumes a verification link. A link is only good for the address it was
 * sent to — if the user has since changed their email, the old link is dead.
 *
 * Re-opening a link that already worked reports success rather than an error:
 * mail scanners often "click" links before the person does, and telling someone
 * whose email *is* verified that their link is broken would be a lie.
 */
export async function verifyEmailToken(rawToken: string): Promise<VerifyTokenResult> {
  if (!rawToken) return "invalid"
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: { select: { email: true, emailVerifiedAt: true } } },
  })
  if (!record || record.email !== record.user.email) return "invalid"
  if (record.user.emailVerifiedAt) return "verified"
  if (record.usedAt || record.expiresAt < new Date()) return "invalid"

  const now = new Date()
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: now } }),
    prisma.emailVerificationToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: now },
    }),
  ])
  return "verified"
}

/**
 * Lets an unverified user fix the address they signed up with — the only way
 * out for someone who mistyped it, since the verification email can never reach
 * them. Kills any links sent to the old address, then sends a fresh one.
 * Verified accounts can't use this; changing a verified address isn't a feature.
 *
 * `email` is set whenever the address was changed — including when the send
 * then failed, which comes back as `error` alongside it.
 */
export async function changeUnverifiedEmail(
  userId: string,
  rawEmail: unknown,
): Promise<{ email?: string; error?: string }> {
  const email = normaliseEmail(rawEmail)
  if (!isValidEmail(email)) return { error: INVALID_EMAIL_MESSAGE }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerifiedAt: true },
  })
  if (!user) return { error: "Account not found." }
  if (user.emailVerifiedAt) return { error: "Your email address is already verified." }
  if (email === user.email) return { error: "That's already the address on your account." }

  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (taken) return { error: "An account with that email already exists." }

  // Deleting the old tokens also lifts the resend cooldown — the new address
  // has never been sent anything. Outstanding password-reset links die too:
  // completing a reset verifies the account's *current* address, so a link sent
  // to the old one must not be able to vouch for the new one.
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { email } }),
    prisma.emailVerificationToken.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ])

  try {
    await sendVerificationEmail(userId)
  } catch (err) {
    console.error("Verification email failed after email change", err)
    return {
      email,
      error: "We updated your address but couldn't send the email. Try resending in a moment.",
    }
  }
  return { email }
}

/** Fresh DB read of whether a user has verified — for session refresh and gating. */
export async function isEmailVerified(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true },
  })
  return !!user?.emailVerifiedAt
}
