import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { normaliseInviteCode } from "@/lib/inviteCode"
import {
  issueMobileTokenPair,
  toMobileUserPublic,
} from "@/lib/mobileAuth"
import { jsonError, readJsonBody } from "@/lib/mobileHttp"

export async function POST(request: Request) {
  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response
  const { body } = parsed

  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : ""
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body.password === "string" ? body.password : ""
  const inviteRaw =
    typeof body.inviteCode === "string" ? normaliseInviteCode(body.inviteCode) : ""

  if (!displayName || !email || !password) {
    return jsonError("All fields are required.", 400)
  }
  if (password.length < 8) {
    return jsonError("Password must be at least 8 characters.", 400)
  }

  // Bad invite must not block sign-up (same as web register).
  let joinLeagueId: string | null = null
  if (inviteRaw) {
    const league = await prisma.league.findUnique({
      where: { inviteCode: inviteRaw },
      select: { id: true },
    })
    joinLeagueId = league?.id ?? null
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return jsonError("An account with that email already exists.", 400)
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName,
      apiKey: crypto.randomUUID(),
      ...(joinLeagueId
        ? { memberships: { create: { leagueId: joinLeagueId, role: "MEMBER" } } }
        : {}),
    },
    select: { id: true, email: true, displayName: true, isBot: true },
  })

  const tokens = await issueMobileTokenPair(user.id)
  return Response.json(
    { user: toMobileUserPublic(user), ...tokens },
    { status: 201 },
  )
}
