import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { emailUnverifiedError, jsonError, readJsonBody } from "@/lib/mobileHttp"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)
  if (!user.emailVerified) return emailUnverifiedError()

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response

  const token = typeof parsed.body.token === "string" ? parsed.body.token.trim() : ""
  const platform =
    typeof parsed.body.platform === "string" ? parsed.body.platform.trim().slice(0, 32) : null

  if (!token || token.length < 8) {
    return jsonError("token is required", 400)
  }

  await prisma.mobileDeviceToken.upsert({
    where: { expoPushToken: token },
    create: { userId: user.id, expoPushToken: token, platform },
    update: { userId: user.id, platform },
  })

  return Response.json({ ok: true })
}

export async function DELETE(request: Request) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response

  const token = typeof parsed.body.token === "string" ? parsed.body.token.trim() : ""
  if (!token) return jsonError("token is required", 400)

  await prisma.mobileDeviceToken.deleteMany({
    where: { userId: user.id, expoPushToken: token },
  })

  return new Response(null, { status: 204 })
}
