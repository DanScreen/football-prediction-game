"use server"

import { revalidatePath } from "next/cache"
import { auth, signOut } from "@/auth"
import { changeUnverifiedEmail, sendVerificationEmail } from "@/lib/emailVerification"

export type VerifyEmailState = { error?: string; message?: string }

export async function resendVerification(
  _prev: VerifyEmailState,
  _formData: FormData,
): Promise<VerifyEmailState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "You're signed out. Sign in again to continue." }

  try {
    const result = await sendVerificationEmail(session.user.id)
    revalidatePath("/verify-email")
    switch (result.status) {
      case "sent":
        return { message: "Sent — check your inbox (and your spam folder)." }
      case "cooldown":
        return { error: `We've just sent one. You can send another in ${result.retryInSeconds}s.` }
      case "already-verified":
        return { message: "Your email is already verified — you're good to go." }
    }
  } catch (err) {
    console.error("Verification email resend failed", err)
    return { error: "We couldn't send the email just now. Try again in a minute." }
  }
}

export async function changeEmail(
  _prev: VerifyEmailState,
  formData: FormData,
): Promise<VerifyEmailState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "You're signed out. Sign in again to continue." }

  const result = await changeUnverifiedEmail(session.user.id, formData.get("email"))
  revalidatePath("/verify-email")
  if (result.error) return { error: result.error }
  return { message: "Address updated — we've sent a new link to it." }
}

export async function signOutFromVerify() {
  await signOut({ redirectTo: "/login" })
}
