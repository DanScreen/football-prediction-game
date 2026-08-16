import { requestPasswordReset } from "@/lib/passwordReset"
import { jsonError, readJsonBody } from "@/lib/mobileHttp"

/**
 * Always 204 — same anti-enumeration behaviour as the web forgot-password flow.
 * Reset link opens the website; app deep-links come later.
 */
export async function POST(request: Request) {
  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response
  const email =
    typeof parsed.body.email === "string" ? parsed.body.email.trim().toLowerCase() : ""
  if (!email) return jsonError("Email is required.", 400)

  try {
    await requestPasswordReset(email)
  } catch {
    // Still 204 — don't leak mailer failures as account existence.
  }
  return new Response(null, { status: 204 })
}
