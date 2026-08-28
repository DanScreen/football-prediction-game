import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { jsonError } from "@/lib/mobileHttp"
import { deleteUserAccount } from "@/lib/accountDeletion"

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

/**
 * Permanent account deletion from inside the app — App Store guideline
 * 5.1.1(v). Shares `deleteUserAccount` with the web profile page, so the two
 * routes cannot end up meaning different things by "delete".
 *
 * The caller's access token stays syntactically valid until it expires, but
 * every request it makes now resolves to no user, and its refresh tokens are
 * gone with the account.
 */
export async function DELETE(request: Request) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)

  await deleteUserAccount(user.id)
  return new Response(null, { status: 204 })
}
