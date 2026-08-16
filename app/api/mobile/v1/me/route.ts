import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { jsonError } from "@/lib/mobileHttp"

export async function GET(request: Request) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)

  const memberships = await prisma.leagueMembership.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: "asc" },
    select: {
      role: true,
      league: {
        select: {
          id: true,
          name: true,
          competitionId: true,
          competition: { select: { name: true } },
        },
      },
    },
  })

  return Response.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isBot: user.isBot,
    leagues: memberships.map((m) => ({
      id: m.league.id,
      name: m.league.name,
      role: m.role,
      competitionId: m.league.competitionId,
      competitionName: m.league.competition.name,
    })),
  })
}
