import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { jsonError } from "@/lib/mobileHttp"
import { sendVerificationEmail } from "@/lib/emailVerification"

/**
 * Send (or re-send) the verification link to the signed-in user's address.
 * Deliberately *not* gated on verification — it's how an unverified user gets
 * unstuck. `already-verified` is a 200 so the app can just move on.
 */
export async function POST(request: Request) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)

  try {
    const result = await sendVerificationEmail(user.id)
    if (result.status === "cooldown") {
      return Response.json(
        {
          error: `We've just sent one. You can send another in ${result.retryInSeconds}s.`,
          retryInSeconds: result.retryInSeconds,
        },
        { status: 429, headers: { "retry-after": String(result.retryInSeconds) } },
      )
    }
    return Response.json({ status: result.status })
  } catch (err) {
    console.error("Verification email resend failed (mobile)", err)
    return jsonError("We couldn't send the email just now. Try again in a minute.", 502)
  }
}
