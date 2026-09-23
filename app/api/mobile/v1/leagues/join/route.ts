import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { emailUnverifiedError, jsonError, readJsonBody } from "@/lib/mobileHttp"
import { normaliseInviteCode } from "@/lib/inviteCode"

export async function POST(request: Request) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)
  if (!user.emailVerified) return emailUnverifiedError()

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response

  const code = normaliseInviteCode(
    typeof parsed.body.inviteCode === "string" ? parsed.body.inviteCode : null,
  )
  if (!code) return jsonError("Please enter an invite code.", 400)

  const league = await prisma.league.findUnique({
    where: { inviteCode: code },
    select: {
      id: true,
      name: true,
      inviteCode: true,
      competitionId: true,
      competition: { select: { name: true, archivedAt: true } },
    },
  })
  if (!league) return jsonError("No league found with that invite code.", 404)
  if (league.competition.archivedAt) {
    return jsonError(
      `${league.competition.name} has finished — that league is closed to new members.`,
      409,
    )
  }

  const existing = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: user.id, leagueId: league.id } },
  })
  if (existing) {
    return jsonError("You're already a member of that league.", 409)
  }

  await prisma.leagueMembership.create({
    data: { userId: user.id, leagueId: league.id, role: "MEMBER" },
  })

  return Response.json(
    {
      id: league.id,
      name: league.name,
      inviteCode: league.inviteCode,
      role: "MEMBER",
      competitionId: league.competitionId,
      competitionName: league.competition.name,
    },
    { status: 201 },
  )
}
