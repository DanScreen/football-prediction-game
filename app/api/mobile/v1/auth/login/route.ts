import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { issueMobileTokenPair, toMobileUserPublic } from "@/lib/mobileAuth"
import { touchLastSeen } from "@/lib/lastSeen"
import { jsonError, readJsonBody } from "@/lib/mobileHttp"
import { normaliseEmail } from "@/lib/emailAddress"

export async function POST(request: Request) {
  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response
  const { body } = parsed

  const email = normaliseEmail(body.email)
  const password = typeof body.password === "string" ? body.password : ""
  if (!email || !password) {
    return jsonError("Email and password are required.", 400)
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return jsonError("Invalid email or password.", 401)

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return jsonError("Invalid email or password.", 401)

  await touchLastSeen(user.id)
  const tokens = await issueMobileTokenPair(user.id)
  return Response.json({
    user: toMobileUserPublic(user),
    ...tokens,
  })
}
