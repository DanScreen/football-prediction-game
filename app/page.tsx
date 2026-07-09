import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getActiveLeagueId } from "@/lib/activeLeague"
import { scoreOnePrediction } from "@/lib/scoring"
import Link from "next/link"
import Countdown from "@/app/components/Countdown"
import PredictionInput from "@/app/components/PredictionInput"
import RequestResultButton from "@/app/components/RequestResultButton"
import { RESULT_DELAY_MS } from "@/lib/resolution"
import { provisionalPoints } from "@/lib/provisional"

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
          <h1 className="text-2xl font-bold text-ink mb-2">Welcome to Scorers</h1>
          <p className="text-ink-muted mb-8">
            Create a new league or join one with an invite code to get started.
          </p>
          <Link
            href="/leagues"
            className="inline-block bg-pitch text-white px-6 py-3 rounded-xl font-semibold shadow-card hover:bg-pitch-deep transition-colors"
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
    include: {
      memberships: { select: { userId: true } },
      competition: { select: { name: true } },
    },
  })

  if (!league) {
    redirect("/leagues")
  }

  // Check user is actually a member
  const isMember = league.memberships.some((m) => m.userId === userId)
  if (!isMember) redirect("/leagues")

  const leagueMemberIds = league.memberships.map((m) => m.userId)
  const competitionName = league.competition.name
  const now = new Date()
  const cutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

  // Fixtures are canonical per competition, so every prediction query filters
  // to league members — other leagues' users predict the same fixtures
  const [fixtures, scoredPredictions, leagueMembers, bonusAwards] = await Promise.all([
    prisma.fixture.findMany({
      where: {
        competitionId: league.competitionId,
        status: { in: ["SCHEDULED", "AWAITING_RESULT"] },
        kickoffTime: { gte: cutoff },
      },
      orderBy: { kickoffTime: "asc" },
      include: {
        predictions: {
          where: { userId: { in: leagueMemberIds } },
          include: { user: { select: { id: true, displayName: true, isBot: true } } },
        },
      },
    }),
    prisma.prediction.findMany({
      where: {
        userId: { in: leagueMemberIds },
        fixture: { competitionId: league.competitionId },
        pointsAwarded: { not: null },
      },
      select: {
        userId: true,
        pointsAwarded: true,
        predictedHomeScore: true,
        predictedAwayScore: true,
        fixture: { select: { actualHomeScore: true, actualAwayScore: true } },
      },
    }),
    prisma.user.findMany({
      where: { id: { in: leagueMemberIds } },
      select: { id: true, displayName: true },
    }),
    prisma.bonusAward.findMany({
      where: { leagueId: activeLeagueId },
      select: { userId: true, points: true },
    }),
  ])

  // Compute rank for current user (base points + Grand Slam bonuses)
  const pointsByUser = new Map<string, number>()
  for (const p of scoredPredictions) {
    pointsByUser.set(p.userId, (pointsByUser.get(p.userId) ?? 0) + (p.pointsAwarded ?? 0))
  }
  for (const b of bonusAwards) {
    pointsByUser.set(b.userId, (pointsByUser.get(b.userId) ?? 0) + b.points)
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

  const myExact = scoredPredictions.filter(
    (p) =>
      p.userId === userId &&
      p.fixture.actualHomeScore !== null &&
      p.fixture.actualAwayScore !== null &&
      scoreOnePrediction(
        p.predictedHomeScore,
        p.predictedAwayScore,
        p.fixture.actualHomeScore,
        p.fixture.actualAwayScore,
      ) === 3,
  ).length

  const open = fixtures.filter((f) => new Date(f.kickoffTime) > now)
  const locked = fixtures.filter((f) => new Date(f.kickoffTime) <= now)

  // Provisional points from proposed-but-unconfirmed results (display only)
  const myProvisional = locked.reduce((sum, f) => {
    const myPick = f.predictions.find((p) => p.userId === userId)
    return sum + (myPick ? (provisionalPoints(myPick, f) ?? 0) : 0)
  }, 0)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* League header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">{league.name}</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            {league.competition.name} · {league.memberships.length} member
            {league.memberships.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/leagues" className="text-sm text-ink-muted hover:text-ink-mid transition-colors">
          Switch league →
        </Link>
      </div>

      {/* Performance card */}
      {scoredPredictions.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-surface rounded-xl border border-line shadow-card px-4 py-3 text-center">
            <p className="score-digits text-2xl text-ink">
              {myRank === 1 ? "🥇" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : `#${myRank}`}
            </p>
            <p className="text-xs text-ink-muted mt-1 font-medium uppercase tracking-wide">Rank</p>
          </div>
          <div className="bg-surface rounded-xl border border-line shadow-card px-4 py-3 text-center">
            <p className="score-digits text-2xl text-ink">{myPoints}</p>
            <p className="text-xs text-ink-muted mt-1 font-medium uppercase tracking-wide">
              Points
              {myProvisional > 0 && (
                <span className="ml-1 normal-case text-clock font-semibold">
                  +{myProvisional} prov.
                </span>
              )}
            </p>
          </div>
          <div className="bg-surface rounded-xl border border-line shadow-card px-4 py-3 text-center">
            <p className="score-digits text-2xl text-ink">{myExact}</p>
            <p className="text-xs text-ink-muted mt-1 font-medium uppercase tracking-wide">Exact ⚽</p>
          </div>
        </div>
      )}

      {/* Open fixtures */}
      <h2 className="text-lg font-bold text-ink mb-1">Upcoming Fixtures</h2>
      <p className="text-ink-muted text-sm mb-4">Submit your predictions before each kickoff.</p>

      {open.length === 0 ? (
        <div className="text-center py-12 text-ink-faint mb-8">
          <p className="text-4xl mb-2">📅</p>
          <p className="font-medium text-ink-muted">No upcoming fixtures.</p>
          <p className="text-sm mt-1">
            Fixtures are added automatically as soon as the next rounds are announced.
          </p>
        </div>
      ) : (
        <div className="space-y-3 mb-10">
          {open.map((f) => {
            const myPick = f.predictions.find((p) => p.userId === userId)
            return (
              <div
                key={f.id}
                className="bg-surface rounded-xl border border-line shadow-card overflow-hidden"
              >
                <div className="flex items-center justify-between gap-4 border-b border-line-soft px-5 py-2.5">
                  <p className="min-w-0 truncate text-xs font-medium text-ink-muted">
                    {competitionName} · {f.round} ·{" "}
                    {new Date(f.kickoffTime).toLocaleString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <div className="shrink-0">
                    <Countdown kickoffTime={f.kickoffTime.toISOString()} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <p className="order-1 min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
                    {f.homeTeam}
                  </p>
                  <div className="order-3 flex w-full justify-center sm:order-2 sm:w-auto">
                    <PredictionInput
                      fixtureId={f.id}
                      savedHome={myPick?.predictedHomeScore}
                      savedAway={myPick?.predictedAwayScore}
                    />
                  </div>
                  <p className="order-2 min-w-0 flex-1 truncate text-right text-[15px] font-semibold text-ink sm:order-3">
                    {f.awayTeam}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Kicked off — show everyone's picks */}
      {locked.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-ink mb-1">Kicked Off</h2>
          <p className="text-ink-muted text-sm mb-4">Predictions locked — see what everyone picked.</p>
          <div className="space-y-3">
            {locked.map((f) => {
              const myPick = f.predictions.find((p) => p.userId === userId)
              const others = f.predictions.filter((p) => p.userId !== userId)

              return (
                <div
                  key={f.id}
                  className="bg-surface rounded-xl border border-line shadow-card overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-4 border-b border-line-soft px-5 py-2.5">
                    <p className="min-w-0 truncate text-xs font-medium text-ink-muted">
                      {competitionName} · {f.round} ·{" "}
                      {new Date(f.kickoffTime).toLocaleString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {f.proposedHomeScore === null && (
                      <span className="shrink-0 text-xs font-semibold text-red-500">🔒 Locked</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-1">
                    <p className="order-1 min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
                      {f.homeTeam}
                    </p>
                    <div className="order-3 flex w-full flex-col items-center sm:order-2 sm:w-auto">
                      {f.proposedHomeScore !== null && f.proposedAwayScore !== null ? (
                        <>
                          <span className="score-digits inline-flex items-center gap-2 rounded-lg bg-board px-3.5 py-1.5 text-xl text-board-gold">
                            {f.proposedHomeScore}
                            <span className="text-board-muted">–</span>
                            {f.proposedAwayScore}
                          </span>
                          <span className="mt-1 text-xs font-medium text-clock">
                            awaiting confirmation
                          </span>
                        </>
                      ) : (
                        <span className="score-digits inline-flex items-center gap-2 rounded-lg bg-board px-3.5 py-1.5 text-xl text-board-muted">
                          ·<span>–</span>·
                        </span>
                      )}
                    </div>
                    <p className="order-2 min-w-0 flex-1 truncate text-right text-[15px] font-semibold text-ink sm:order-3">
                      {f.awayTeam}
                    </p>
                  </div>

                  <div className="mx-5 mt-3 mb-4 border-t border-line-soft pt-3 space-y-1.5">
                    {myPick && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-pitch font-semibold w-24 truncate">You</span>
                        <span className="font-bold tabular-nums">
                          {myPick.predictedHomeScore} – {myPick.predictedAwayScore}
                        </span>
                        {provisionalPoints(myPick, f) !== null && (
                          <span className="rounded-md bg-clock-tint px-1.5 py-0.5 text-xs font-semibold text-clock">
                            +{provisionalPoints(myPick, f)} prov.
                          </span>
                        )}
                      </div>
                    )}
                    {!myPick && (
                      <p className="text-xs text-ink-faint italic">You didn&apos;t submit a prediction.</p>
                    )}
                    {others.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 text-sm text-ink-muted">
                        <span className="w-24 truncate">
                          {p.user.isBot ? "🤖 " : ""}
                          {p.user.displayName}
                        </span>
                        <span className="font-medium tabular-nums">
                          {p.predictedHomeScore} – {p.predictedAwayScore}
                        </span>
                        {provisionalPoints(p, f) !== null && (
                          <span className="rounded-md bg-clock-tint px-1.5 py-0.5 text-xs font-medium text-clock">
                            +{provisionalPoints(p, f)}
                          </span>
                        )}
                      </div>
                    ))}
                    {f.predictions.length === 0 && (
                      <p className="text-xs text-ink-faint italic">No predictions submitted.</p>
                    )}
                  </div>

                  {f.proposedHomeScore === null &&
                    f.kickoffTime.getTime() + RESULT_DELAY_MS <= now.getTime() && (
                      <div className="mx-5 mb-4 border-t border-line-soft pt-3">
                        <RequestResultButton fixtureId={f.id} />
                      </div>
                    )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
