import { prisma } from "@/lib/prisma"
import { authenticateMobileAccess } from "@/lib/mobileAuth"
import { emailUnverifiedError, jsonError } from "@/lib/mobileHttp"
import { computeLeaderboard, computeLeagueForm, listPlayedRounds } from "@/lib/leaderboard"

export async function GET(request: Request) {
  const user = await authenticateMobileAccess(request)
  if (!user) return jsonError("Unauthorized", 401)
  if (!user.emailVerified) return emailUnverifiedError()

  // `?archived=1` includes leagues on finished competitions, mirroring
  // `/leaderboard?archived=1` on the web. Default is live competitions only.
  const includeArchived =
    new URL(request.url).searchParams.get("archived") === "1"

  const memberships = await prisma.leagueMembership.findMany({
    where: {
      userId: user.id,
      ...(includeArchived ? {} : { league: { competition: { archivedAt: null } } }),
    },
    orderBy: { joinedAt: "asc" },
    select: {
      league: {
        select: {
          id: true,
          name: true,
          competition: { select: { name: true, archivedAt: true } },
        },
      },
    },
  })

  const blocks = await Promise.all(
    memberships.map(async (m) => {
      const [ranked, form, playedRounds] = await Promise.all([
        computeLeaderboard(m.league.id),
        computeLeagueForm(m.league.id),
        listPlayedRounds(m.league.id),
      ])
      return {
        leagueId: m.league.id,
        leagueName: m.league.name,
        competitionName: m.league.competition.name,
        /** Set when a host has declared the competition finished. */
        competitionArchived: m.league.competition.archivedAt !== null,
        /** Round names behind the form strip, oldest → newest. */
        formRounds: form.rounds,
        /**
         * Every round that has kicked off, newest first — the gameweek picker's
         * range. Names only; a round's table is fetched from
         * `/leaderboards/round` when the player actually opens it, because
         * sending every round's standings up front would multiply this payload
         * by the length of the season to serve one gameweek at a time.
         */
        playedRounds,
        standings: ranked.map((e) => ({
          rank: e.rank,
          id: e.id,
          displayName: e.displayName,
          isBot: e.isBot,
          totalPoints: e.confirmedPoints,
          provisionalPoints: e.provisionalPoints,
          projectedPoints: e.confirmedPoints + e.provisionalPoints,
          exactCount: e.exactCount,
          streakPoints: e.streakPoints,
          pointsBreakdown: e.breakdown,
          /** One cell per `formRounds` entry, same order. */
          form: form.byUser.get(e.id) ?? [],
        })),
      }
    }),
  )

  return Response.json(blocks)
}
