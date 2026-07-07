"use server"

import { requestPasswordReset } from "@/lib/passwordReset"

export type ForgotPasswordState = { submitted?: boolean; error?: string }

export async function requestReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  if (!email) return { error: "Email is required." }

  try {
    await requestPasswordReset(email)
  } catch {
    return { error: "Something went wrong sending the email. Please try again shortly." }
  }

  // Always the same response, whether or not the email is registered.
  return { submitted: true }
}
