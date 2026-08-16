import {
  authenticateMobileAccess,
  revokeAllMobileRefreshTokens,
  revokeMobileRefreshToken,
} from "@/lib/mobileAuth"
import { jsonError, readJsonBody } from "@/lib/mobileHttp"

export async function POST(request: Request) {
  let refreshToken: string | undefined
  // Body is optional — access-token-only logout revokes all sessions for the user.
  const contentType = request.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    const parsed = await readJsonBody(request)
    if (!parsed.ok) return parsed.response
    if (typeof parsed.body.refreshToken === "string") {
      refreshToken = parsed.body.refreshToken.trim()
    }
  }

  if (refreshToken) {
    await revokeMobileRefreshToken(refreshToken)
    return new Response(null, { status: 204 })
  }

  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)

  await revokeAllMobileRefreshTokens(user.id)
  return new Response(null, { status: 204 })
}
