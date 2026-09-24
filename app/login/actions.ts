"use server"

import { signIn } from "@/auth"
import { AuthError } from "next-auth"

// `email` is echoed back so the form can keep it: React resets the form
// after the action, which would otherwise wipe it on a wrong password.
export type LoginState = { error?: string; email?: string }

export async function loginUser(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const typedEmail = String(formData.get("email") ?? "")
  const email = typedEmail.trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const callbackUrl = String(formData.get("callbackUrl") ?? "") || "/"

  if (!email || !password) return { error: "Email and password are required.", email: typedEmail }

  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password.", email: typedEmail }
    }
    throw error // re-throw next-auth's internal redirect
  }
  return {}
}
