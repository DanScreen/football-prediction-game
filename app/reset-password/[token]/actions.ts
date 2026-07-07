"use server"

import { redirect } from "next/navigation"
import { resetPassword } from "@/lib/passwordReset"

export type ResetPasswordState = { error?: string }

export async function submitNewPassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "")
  const password = String(formData.get("password") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")

  if (!password || !confirmPassword) return { error: "All fields are required." }
  if (password !== confirmPassword) return { error: "Passwords do not match." }
  if (password.length < 8) return { error: "Password must be at least 8 characters." }

  const result = await resetPassword(token, password)
  if (result.error) return result

  redirect("/login?reset=1")
}
