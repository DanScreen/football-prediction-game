"use server"

import { redirect } from "next/navigation"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { normaliseInviteCode } from "@/lib/inviteCode"

export type RegisterState = {
  error?: string
}

export async function registerUser(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const displayName = String(formData.get("displayName") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")
  // Now only ever arrives from the hidden field an invite link populates — the
  // visible "invite code" box was removed from sign-up.
  const inviteCode = normaliseInviteCode(formData.get("inviteCode") as string | null)

  // Basic validation
  if (!displayName || !email || !password) {
    return { error: "All fields are required." }
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." }
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." }
  }

  // A bad invite must not block sign-up: accounts are open, and the code here came
  // from a link the user can't see or correct. They just land without a league and
  // can join one from /leagues.
  let joinLeagueId: string | null = null
  if (inviteCode) {
    const league = await prisma.league.findUnique({
      where: { inviteCode },
      select: { id: true },
    })
    joinLeagueId = league?.id ?? null
  }

  // Check for duplicate email
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return { error: "An account with that email already exists." }
  }

  // Hash password and create user
  const passwordHash = await bcrypt.hash(password, 12)
  const apiKey = crypto.randomUUID()

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName,
      apiKey,
      ...(joinLeagueId
        ? { memberships: { create: { leagueId: joinLeagueId, role: "MEMBER" } } }
        : {}),
    },
  })

  redirect("/login?registered=1")
}
