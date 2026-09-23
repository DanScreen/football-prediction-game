import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { emailUnverifiedError, jsonError, readJsonBody } from "@/lib/mobileHttp"
import { generateInviteCode, normaliseInviteCode } from "@/lib/inviteCode"

export async function GET(request: Request) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)
  if (!user.emailVerified) return emailUnverifiedError()

  const memberships = await prisma.leagueMembership.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: "asc" },
    select: {
      role: true,
      league: {
        select: {
          id: true,
          name: true,
          inviteCode: true,
          competitionId: true,
          competition: { select: { name: true, archivedAt: true } },
        },
      },
    },
  })

  // Archived leagues stay in this list — the Leagues tab is where history
  // lives — but carry a flag so the app can file them under "Finished".
  return Response.json(
    memberships.map((m) => ({
      id: m.league.id,
      name: m.league.name,
      inviteCode: m.league.inviteCode,
      role: m.role,
      competitionId: m.league.competitionId,
      competitionName: m.league.competition.name,
      competitionArchived: m.league.competition.archivedAt !== null,
    })),
  )
}

export async function POST(request: Request) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)
  if (!user.emailVerified) return emailUnverifiedError()

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response
  const { body } = parsed

  const name = typeof body.name === "string" ? body.name.trim() : ""
  const competitionId =
    typeof body.competitionId === "string" ? body.competitionId.trim() : ""

  if (!name) return jsonError("League name is required.", 400)
  if (name.length > 50) return jsonError("League name must be 50 characters or fewer.", 400)
  if (!competitionId) return jsonError("Please select a competition.", 400)

  const competition = await prisma.competition.findUnique({ where: { id: competitionId } })
  if (!competition || !competition.isActive || competition.archivedAt) {
    return jsonError("That competition isn't available.", 400)
  }

  const inviteCode = generateInviteCode()
  const league = await prisma.league.create({
    data: {
      name,
      competitionId,
      inviteCode,
      memberships: { create: { userId: user.id, role: "COMMISSIONER" } },
    },
    select: {
      id: true,
      name: true,
      inviteCode: true,
      competitionId: true,
      competition: { select: { name: true } },
    },
  })

  return Response.json(
    {
      id: league.id,
      name: league.name,
      inviteCode: league.inviteCode,
      role: "COMMISSIONER",
      competitionId: league.competitionId,
      competitionName: league.competition.name,
    },
    { status: 201 },
  )
}
