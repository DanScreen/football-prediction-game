import { rotateMobileRefreshToken } from "@/lib/mobileAuth"
import { jsonError, readJsonBody } from "@/lib/mobileHttp"

export async function POST(request: Request) {
  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response
  const { body } = parsed

  const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken.trim() : ""
  if (!refreshToken) return jsonError("refreshToken is required.", 400)

  const rotated = await rotateMobileRefreshToken(refreshToken)
  if (!rotated) return jsonError("Invalid or expired refresh token.", 401)

  return Response.json({
    accessToken: rotated.accessToken,
    refreshToken: rotated.refreshToken,
  })
}
