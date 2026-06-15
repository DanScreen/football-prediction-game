"use server"

import { redirect } from "next/navigation"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

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
  const inviteCode = String(formData.get("inviteCode") ?? "").trim()

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

  // Verify invite code only if one was provided
  if (inviteCode) {
    const league = await prisma.league.findUnique({ where: { inviteCode } })
    if (!league) {
      return { error: "Invalid invite code." }
    }
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
    },
  })

  redirect("/login?registered=1")
}
