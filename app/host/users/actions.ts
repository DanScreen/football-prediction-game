"use server"

import { revalidatePath } from "next/cache"
import { requireSiteAdmin } from "@/lib/adminAuth"
import { prisma } from "@/lib/prisma"
import { changeUnverifiedEmail, sendVerificationEmail } from "@/lib/emailVerification"
import { sendPasswordResetEmail } from "@/lib/passwordReset"

export type HostUserActionResult = { error?: string; message?: string }

async function findHuman(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, isBot: true },
  })
  if (!user) return { error: "User not found." }
  if (user.isBot) return { error: "Bots don't have a mailbox to send to." }
  return { user }
}

/** Emails a fresh verification link. The user's own 60 s resend cooldown still applies. */
export async function sendVerificationLink(userId: string): Promise<HostUserActionResult> {
  const { userId: hostId } = await requireSiteAdmin()
  const found = await findHuman(userId)
  if (!found.user) return { error: found.error }

  try {
    const result = await sendVerificationEmail(userId)
    revalidatePath("/host/users")
    switch (result.status) {
      case "sent":
        console.info(`[host] ${hostId} sent a verification link to ${userId}`)
        return { message: `Verification link sent to ${found.user.email}.` }
      case "already-verified":
        return { error: "Already verified — no link needed." }
      case "cooldown":
        return { error: `A link went out moments ago. Try again in ${result.retryInSeconds}s.` }
    }
  } catch (err) {
    console.error("Host verification send failed", err)
    return { error: "The email couldn't be sent. Try again shortly." }
  }
}

/** Emails a password reset link (valid 1 hour). Held back within 5 min of the last one. */
export async function sendResetLink(userId: string): Promise<HostUserActionResult> {
  const { userId: hostId } = await requireSiteAdmin()
  const found = await findHuman(userId)
  if (!found.user) return { error: found.error }

  try {
    const result = await sendPasswordResetEmail(userId)
    revalidatePath("/host/users")
    if (result.status === "cooldown") {
      const minutes = Math.ceil(result.retryInSeconds / 60)
      return {
        error: `A reset link went out recently and still works. You can send another in ${minutes} min.`,
      }
    }
    console.info(`[host] ${hostId} sent a password reset link to ${userId}`)
    return { message: `Reset link sent to ${found.user.email}.` }
  } catch (err) {
    console.error("Host password reset send failed", err)
    return { error: "The email couldn't be sent. Try again shortly." }
  }
}

/**
 * Corrects a mistyped address on an unverified account (usually after the
 * player contacts support) and sends a link to the new one. Same rules as the
 * player's own "Change it" on the verify page.
 */
export async function fixUnverifiedEmail(
  userId: string,
  email: string,
): Promise<HostUserActionResult> {
  const { userId: hostId } = await requireSiteAdmin()
  const found = await findHuman(userId)
  if (!found.user) return { error: found.error }

  const result = await changeUnverifiedEmail(userId, email)
  revalidatePath("/host/users")
  if (!result.email) return { error: result.error ?? "Couldn't update the email." }
  console.info(`[host] ${hostId} changed the unverified email for ${userId}`)
  if (result.error) return { error: result.error }
  return { message: `Updated to ${result.email} and sent a verification link.` }
}
