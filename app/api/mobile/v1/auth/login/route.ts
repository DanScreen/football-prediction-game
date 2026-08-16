import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { issueMobileTokenPair, toMobileUserPublic } from "@/lib/mobileAuth"
import { jsonError, readJsonBody } from "@/lib/mobileHttp"

export async function POST(request: Request) {
  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response
  const { body } = parsed

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body.password === "string" ? body.password : ""
  if (!email || !password) {
    return jsonError("Email and password are required.", 400)
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return jsonError("Invalid email or password.", 401)

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return jsonError("Invalid email or password.", 401)

  const tokens = await issueMobileTokenPair(user.id)
  return Response.json({
    user: toMobileUserPublic(user),
    ...tokens,
  })
}
