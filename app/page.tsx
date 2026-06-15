import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getActiveLeagueId } from "@/lib/activeLeague"
import Link from "next/link"
import Countdown from "@/app/components/Countdown"
import PredictionInput from "@/app/components/PredictionInput"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const activeLeagueId = await getActiveLeagueId()

  // No league yet — prompt to create or join
  if (!activeLeagueId) {
    const anyMembership = await prisma.leagueMembership.findFirst({ where: { userId } })
    if (!anyMembership) {
      return (
        <div className="max-w-md mx-auto px-4 py-24 text-center">
          <p className="text-5xl mb-4">⚽</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Footy Predictor</h1>
          <p className="text-gray-500 mb-8">
            Create a new league or join one with an invite code to get started.
          </p>
          <Link
            href="/leagues"
            className="inline-block bg-[#1a7a3c] text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors"
          >
            Get Started →
          </Link>
        </div>
      )
    }
    // Has leagues but no cookie — auto-select first
    redirect("/leagues")
  }

  const league = await prisma.league.findUnique({
    where: { id: activeLeagueId },
    include: { memberships: { select: { userId: true } } },
  })

  if (!league) {
    redirect("/leagues")
  }

  // Check user is actually a member
  const isMember = league.memberships.some((m) => m.userId === userId)
  if (!isMember) redirect("/leagues")

  const leagueMemberIds = league.memberships.map((m) => m.userId)
  const now = new Date()
  const cutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

  const [fixtures, scoredPredictions, leagueMembers] = await Promise.all([
    prisma.fixture.findMany({
      where: {
        leagueId: activeLeagueId,
        status: { in: ["SCHEDULED", "AWAITING_RESULT"] },
        kickoffTime: { gte: cutoff },
      },
      orderBy: { kickoffTime: "asc" },
      include: {
        predictions: {
          include: { user: { select: { id: true, displayName: true, isBot: true } } },
        },
      },
    }),
    prisma.prediction.findMany({
      where: {
        fixture: { leagueId: activeLeagueId },
        pointsAwarded: { not: null },
      },
      select: { userId: true, pointsAwarded: true },
    }),
    prisma.user.findMany({
      where: { id: { in: leagueMemberIds } },
      select: { id: true, displayName: true },
    }),
  ])

  // Compute rank for current user
  const pointsByUser = new Map<string, number>()
  for (const p of scoredPredictions) {
    pointsByUser.set(p.userId, (pointsByUser.get(p.userId) ?? 0) + (p.pointsAwarded ?? 0))
  }
  const myPoints = pointsByUser.get(userId) ?? 0

  const sortedPoints = leagueMembers
    .map((u) => pointsByUser.get(u.id) ?? 0)
    .sort((a, b) => b - a)

  let myRank = 1
  for (const pts of sortedPoints) {
    if (pts > myPoints) myRank++
    else break
  }

  const myExact = await prisma.prediction.count({
    where: {
      userId,
      pointsAwarded: { not: null },
      fixture: {
        leagueId: activeLeagueId,
        actualHomeScore: { not: null },
        actualAwayScore: { not: null },
      },
    },
  })

  const open = fixtures.filter((f) => new Date(f.kickoffTime) > now)
  const locked = fixtures.filter((f) => new Date(f.kickoffTime) <= now)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* League header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{league.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {league.memberships.length} member{league.memberships.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/leagues" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
          Switch league →
        </Link>
      </div>

      {/* Performance card */}
      {scoredPredictions.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {myRank === 1 ? "🥇" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : `#${myRank}`}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Rank</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{myPoints}</p>
            <p className="text-xs text-gray-500 mt-0.5">Points</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{myExact}</p>
            <p className="text-xs text-gray-500 mt-0.5">Exact ⚽</p>
          </div>
        </div>
      )}

      {/* Open fixtures */}
      <h2 className="text-lg font-bold text-gray-900 mb-1">Upcoming Fixtures</h2>
      <p className="text-gray-500 text-sm mb-4">Submit your predictions before each kickoff.</p>

      {open.length === 0 ? (
        <div className="text-center py-12 text-gray-400 mb-8">
          <p className="text-4xl mb-2">📅</p>
          <p className="font-medium text-gray-600">No upcoming fixtures.</p>
          <p className="text-sm mt-1">
            {league.memberships.some((m) => m.userId === userId)
              ? "Check back soon — the Commissioner will add matches."
              : ""}
          </p>
        </div>
      ) : (
        <div className="space-y-3 mb-10">
          {open.map((f) => {
            const myPick = f.predictions.find((p) => p.userId === userId)
            return (
              <div
                key={f.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
                      {f.competition} · {f.round}
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {f.homeTeam}{" "}
                      <span className="text-gray-400 font-normal">vs</span>{" "}
                      {f.awayTeam}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(f.kickoffTime).toLocaleString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Countdown kickoffTime={f.kickoffTime.toISOString()} />
                    <p className="text-xs text-gray-400 mt-0.5">until deadline</p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                  <span className="text-xs text-gray-500 font-medium">Your pick:</span>
                  <PredictionInput
                    fixtureId={f.id}
                    savedHome={myPick?.predictedHomeScore}
                    savedAway={myPick?.predictedAwayScore}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Kicked off — show everyone's picks */}
      {locked.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Kicked Off</h2>
          <p className="text-gray-500 text-sm mb-4">Predictions locked — see what everyone picked.</p>
          <div className="space-y-3">
            {locked.map((f) => {
              const myPick = f.predictions.find((p) => p.userId === userId)
              const others = f.predictions.filter((p) => p.userId !== userId)

              return (
                <div
                  key={f.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 opacity-90"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
                        {f.competition} · {f.round}
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {f.homeTeam}{" "}
                        <span className="text-gray-400 font-normal">vs</span>{" "}
                        {f.awayTeam}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(f.kickoffTime).toLocaleString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span className="text-xs text-red-500 font-semibold shrink-0">🔒 Locked</span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                    {myPick && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-[#1a7a3c] font-semibold w-24 truncate">You</span>
                        <span className="font-bold tabular-nums">
                          {myPick.predictedHomeScore} – {myPick.predictedAwayScore}
                        </span>
                      </div>
                    )}
                    {!myPick && (
                      <p className="text-xs text-gray-400 italic">You didn&apos;t submit a prediction.</p>
                    )}
                    {others.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="w-24 truncate">
                          {p.user.isBot ? "🤖 " : ""}
                          {p.user.displayName}
                        </span>
                        <span className="font-medium tabular-nums">
                          {p.predictedHomeScore} – {p.predictedAwayScore}
                        </span>
                      </div>
                    ))}
                    {f.predictions.length === 0 && (
                      <p className="text-xs text-gray-400 italic">No predictions submitted.</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
