import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { resolvePeerContext } from "@/lib/peers"
import PredictionHistory, { type HistoryFixture } from "@/app/PredictionHistory"
import ArchivedOnlyNotice from "@/app/components/ArchivedOnlyNotice"

export const metadata = { title: "Results" }

export default async function ResultsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const ctx = await resolvePeerContext(userId)
  if (!ctx) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <p className="text-5xl mb-4">📋</p>
        <h1 className="text-2xl font-bold text-ink mb-2">Results</h1>
        <p className="text-ink-muted mb-8">
          Join a league to see settled fixtures and everyone&apos;s picks.
        </p>
        <Link
          href="/leagues"
          className="inline-block bg-pitch text-pitch-on px-6 py-3 rounded-xl font-semibold shadow-card hover:bg-pitch-deep transition-colors"
        >
          Get Started →
        </Link>
      </div>
    )
  }

  const {
    memberships,
    archivedMemberships,
    myLeagueIds,
    leagueToCompetition,
    competitionIds,
    peersByCompetition,
    allPeerIds,
  } = ctx

  if (competitionIds.length === 0) {
    return (
      <ArchivedOnlyNotice
        title="No live results"
        leagueNames={archivedMemberships.map((m) => m.league.name)}
      />
    )
  }

  const multipleCompetitions = competitionIds.length > 1

  const [completedFixtures, bonusAwards] = await Promise.all([
    prisma.fixture.findMany({
      where: {
        competitionId: { in: competitionIds },
        status: "COMPLETED",
        predictions: { some: { userId: { in: allPeerIds } } },
      },
      orderBy: { kickoffTime: "desc" },
      include: {
        competition: { select: { name: true } },
        predictions: {
          where: { userId: { in: allPeerIds } },
          include: { user: { select: { id: true, displayName: true, isBot: true, avatarKey: true } } },
        },
      },
    }),
    prisma.bonusAward.findMany({
      where: { userId, leagueId: { in: myLeagueIds } },
      select: { leagueId: true, round: true, points: true },
    }),
  ])

  const fixtures: HistoryFixture[] = completedFixtures.map((f) => {
    const peers = peersByCompetition.get(f.competitionId) ?? new Set<string>()
    return {
      ...f,
      predictions: f.predictions.filter((p) => peers.has(p.userId)),
    }
  })

  const competitionNameById = new Map(memberships.map((m) => [m.league.competition.id, m.league.competition.name]))
  const bonusByRound = new Map<string, number>()
  for (const b of bonusAwards) {
    const competitionId = leagueToCompetition.get(b.leagueId)
    const name = competitionId ? competitionNameById.get(competitionId) : undefined
    if (!name) continue
    const key = `${name}·${b.round}`
    bonusByRound.set(key, (bonusByRound.get(key) ?? 0) + b.points)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink">Results</h1>
      <p className="text-sm text-ink-muted mt-0.5 mb-6">
        {multipleCompetitions
          ? `${competitionIds.length} competitions · settled fixtures, newest round first`
          : `${memberships[0].league.competition.name} · everyone's picks`}
      </p>

      {fixtures.length === 0 ? (
        <div className="text-center py-16 text-ink-faint">
          <p className="text-4xl mb-2">📋</p>
          <p className="font-medium text-ink-muted">No settled results yet.</p>
          <p className="text-sm mt-1">
            Once a host confirms scores, rounds appear here with every league-mate&apos;s pick.
          </p>
          <Link
            href="/"
            className="inline-block mt-6 text-sm font-medium text-pitch hover:underline"
          >
            Back to predictions →
          </Link>
        </div>
      ) : (
        <PredictionHistory fixtures={fixtures} userId={userId} bonusByRound={bonusByRound} />
      )}

      <p className="mt-10 border-t border-line-soft pt-5 text-center text-xs text-ink-muted">
        <Link href="/rules" className="font-medium text-pitch hover:underline">
          How scoring works
        </Link>{" "}
        — points, bankers, deadlines and bonuses.
      </p>
    </div>
  )
}
