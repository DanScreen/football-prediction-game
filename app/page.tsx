import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import OpenFixtureCard from "@/app/components/OpenFixtureCard"
import BankerTag from "@/app/components/BankerTag"
import RequestResultButton from "@/app/components/RequestResultButton"
import { RESULT_DELAY_MS } from "@/lib/resolution"
import { resolvePeerContext } from "@/lib/peers"
import ArchivedOnlyNotice from "@/app/components/ArchivedOnlyNotice"
import { roundsMissingBanker } from "@/lib/bankerNudge"
import FixtureRoundGroup, {
  groupByRound,
  takeNearestRounds,
  VISIBLE_OPEN_ROUNDS,
} from "@/app/FixtureRoundGroup"

/**
 * Predictions — open fixtures to pick on and kicked-off fixtures still in play.
 *
 * Settled results live on `/results`. Deliberately scoped by **competition, not
 * league** — one pick counts in every league on that competition.
 */
export default async function PredictionsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const ctx = await resolvePeerContext(userId)
  if (!ctx) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <p className="text-5xl mb-4">⚽</p>
        <h1 className="text-2xl font-bold text-ink mb-2">Welcome to Scorers</h1>
        <p className="text-ink-muted mb-8">
          Create a new league or join one with an invite code to get started.
        </p>
        <Link
          href="/leagues"
          className="inline-block bg-pitch text-pitch-on px-6 py-3 rounded-xl font-semibold shadow-card hover:bg-pitch-deep transition-colors"
        >
          Get Started →
        </Link>
        <p className="mt-6 text-sm text-ink-muted">
          New to this?{" "}
          <Link href="/rules" className="font-medium text-pitch hover:underline">
            How it works
          </Link>
        </p>
      </div>
    )
  }

  const { memberships, archivedMemberships, competitionIds, peersByCompetition, allPeerIds } = ctx

  // Every league the viewer is in sits on a finished competition — there is
  // nothing to predict, but they are not a new user either.
  if (competitionIds.length === 0) {
    return (
      <ArchivedOnlyNotice
        title="Nothing to predict"
        leagueNames={archivedMemberships.map((m) => m.league.name)}
      />
    )
  }

  const multipleCompetitions = competitionIds.length > 1

  const now = new Date()
  const cutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

  const liveFixtures = await prisma.fixture.findMany({
    where: {
      competitionId: { in: competitionIds },
      status: { in: ["SCHEDULED", "AWAITING_RESULT"] },
      kickoffTime: { gte: cutoff },
    },
    orderBy: { kickoffTime: "asc" },
    include: {
      competition: { select: { name: true } },
      predictions: {
        where: { userId: { in: allPeerIds } },
        include: { user: { select: { id: true, displayName: true, isBot: true } } },
      },
    },
  })

  const open = liveFixtures.filter((f) => f.kickoffTime > now)
  const locked = liveFixtures.filter((f) => f.kickoffTime <= now)

  // Looked up separately rather than read off `liveFixtures`: a banker on a
  // fixture that has already finished (Friday's match, by Saturday) still counts
  // for the round, but finished fixtures aren't in that list — reading it there
  // would show "no banker" and warn about a round that's already bankered.
  const myBankers = await prisma.prediction.findMany({
    where: {
      userId,
      isBanker: true,
      fixture: {
        competitionId: { in: competitionIds },
        round: { in: [...new Set(liveFixtures.map((f) => f.round))] },
      },
    },
    select: {
      fixture: {
        select: { competitionId: true, round: true, homeTeam: true, awayTeam: true },
      },
    },
  })
  const bankerByRound = new Map<string, { homeTeam: string; awayTeam: string }>()
  for (const { fixture: f } of myBankers) {
    bankerByRound.set(`${f.competitionId}·${f.round}`, {
      homeTeam: f.homeTeam,
      awayTeam: f.awayTeam,
    })
  }
  const bankerOf = (group: { key: string }) => bankerByRound.get(group.key) ?? null

  // Only the current gameweek and the next one are pickable here; anything
  // further out is hidden rather than filtered from the query, so bankers and
  // the deadline nudge below still see the same set the player can act on.
  const openRounds = takeNearestRounds(groupByRound(open), VISIBLE_OPEN_ROUNDS)
  const lockedRounds = groupByRound(locked)

  const nudgeRounds: typeof openRounds = []
  const claimed = new Set<string>()
  for (const group of openRounds) {
    const competitionId = group.fixtures[0].competitionId
    if (claimed.has(competitionId)) continue
    if (!group.fixtures.some((f) => !f.predictions.some((p) => p.userId === userId))) continue
    claimed.add(competitionId)
    nudgeRounds.push(group)
  }

  const missing = nudgeRounds.flatMap((g) =>
    g.fixtures.filter((f) => !f.predictions.some((p) => p.userId === userId)),
  )
  const nextDeadline = missing.reduce<Date | null>(
    (soonest, f) => (soonest === null || f.kickoffTime < soonest ? f.kickoffTime : soonest),
    null,
  )

  const noBanker = roundsMissingBanker(openRounds, new Set(bankerByRound.keys()))

  const firstUnfinishedRound = openRounds.findIndex((g) =>
    g.fixtures.some((f) => !f.predictions.some((p) => p.userId === userId)),
  )
  const expandedRound = firstUnfinishedRound === -1 ? 0 : firstUnfinishedRound

  const fixtureMeta = (f: (typeof liveFixtures)[number]) =>
    new Date(f.kickoffTime).toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink">Predictions</h1>
      <p className="text-sm text-ink-muted mt-0.5 mb-6">
        {multipleCompetitions
          ? `${competitionIds.length} competitions · your picks count in every league you're in`
          : memberships[0].league.competition.name}
      </p>

      {((missing.length > 0 && nextDeadline) || noBanker.length > 0) && (
        <div className="mb-8 space-y-3">
          {missing.length > 0 && nextDeadline && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-clock-line bg-clock-tint px-4 py-3">
              <p className="text-sm font-semibold text-clock">
                {missing.length} fixture{missing.length !== 1 ? "s" : ""} to predict in{" "}
                {nudgeRounds.length === 1 ? nudgeRounds[0].round : "your next gameweeks"}
              </p>
              <p className="text-xs text-clock/90">
                Next deadline{" "}
                {new Date(nextDeadline).toLocaleString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          )}

          {noBanker.length > 0 && (
            <div
              role="status"
              className="flex items-start gap-3 rounded-xl border border-clock-line bg-clock-tint px-4 py-3"
            >
              <span aria-hidden="true" className="text-lg leading-tight text-clock">
                ☆
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-clock">
                  No banker set for{" "}
                  {noBanker
                    .map((g) =>
                      multipleCompetitions ? `${g.round} (${g.competitionName})` : g.round,
                    )
                    .join(" and ")}
                </p>
                <p className="text-xs text-clock/90">
                  Use ☆ Banker on your most confident pick to double its points — before it
                  kicks off.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <h2 className="text-lg font-bold text-ink mb-1">Open</h2>
      <p className="text-ink-muted text-sm mb-4">
        Enter both scores — they save automatically before each kickoff.
      </p>

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
          {openRounds.map((group, i) => (
            <FixtureRoundGroup
              key={group.key}
              round={group.round}
              competitionName={group.competitionName}
              kickoff={group.kickoff}
              count={group.fixtures.length}
              outstanding={
                group.fixtures.filter((f) => !f.predictions.some((p) => p.userId === userId))
                  .length
              }
              banker={bankerOf(group)}
              defaultOpen={i === expandedRound}
            >
              {group.fixtures.map((f) => {
                const myPick = f.predictions.find((p) => p.userId === userId)
                return (
                  <OpenFixtureCard
                    key={f.id}
                    fixtureId={f.id}
                    homeTeam={f.homeTeam}
                    awayTeam={f.awayTeam}
                    kickoffIso={f.kickoffTime.toISOString()}
                    kickoffLabel={fixtureMeta(f)}
                    savedHome={myPick?.predictedHomeScore}
                    savedAway={myPick?.predictedAwayScore}
                    isBanker={myPick?.isBanker ?? false}
                  />
                )
              })}
            </FixtureRoundGroup>
          ))}
        </div>
      )}

      {locked.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-ink mb-1">Kicked Off</h2>
          <p className="text-ink-muted text-sm mb-4">
            Predictions locked — see what everyone picked.
          </p>
          <div className="space-y-3 mb-10">
            {lockedRounds.map((group, i) => (
              <FixtureRoundGroup
                key={group.key}
                round={group.round}
                competitionName={group.competitionName}
                kickoff={group.kickoff}
                count={group.fixtures.length}
                banker={bankerOf(group)}
                defaultOpen={i === lockedRounds.length - 1}
              >
                {group.fixtures.map((f) => {
                  const peers = peersByCompetition.get(f.competitionId) ?? new Set<string>()
                  const visible = f.predictions.filter((p) => peers.has(p.userId))
                  const myPick = visible.find((p) => p.userId === userId)
                  const others = visible.filter((p) => p.userId !== userId)

                  return (
                    <div
                      key={f.id}
                      className="bg-surface rounded-xl border border-line shadow-card overflow-hidden"
                    >
                      <div className="flex items-center justify-between gap-4 border-b border-line-soft px-5 py-2.5">
                        <p className="min-w-0 truncate text-xs font-medium text-ink-muted">
                          {fixtureMeta(f)}
                        </p>
                    {f.proposedHomeScore === null && (
                      <span className="shrink-0 text-xs font-semibold text-bad">🔒 Locked</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-1">
                    <p className="order-1 min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
                      {f.homeTeam}
                    </p>
                    <div className="order-3 flex w-full flex-col items-center sm:order-2 sm:w-auto">
                      <span className="score-digits inline-flex items-center gap-2 rounded-lg bg-board px-3.5 py-1.5 text-xl text-board-muted">
                        ·<span>–</span>·
                      </span>
                      <span className="mt-1 text-xs font-medium text-ink-muted">awaiting result</span>
                    </div>
                        <p className="order-2 min-w-0 flex-1 truncate text-right text-[15px] font-semibold text-ink sm:order-3">
                          {f.awayTeam}
                        </p>
                      </div>

                      <div className="mx-5 mt-3 mb-4 border-t border-line-soft pt-3 space-y-1.5">
                        {myPick ? (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-pitch font-semibold w-24 truncate">You</span>
                            <span className="font-bold tabular-nums">
                              {myPick.predictedHomeScore} – {myPick.predictedAwayScore}
                            </span>
                        {myPick.isBanker && <BankerTag />}
                      </div>
                    ) : (
                          <p className="text-xs text-ink-faint italic">
                            You didn&apos;t submit a prediction.
                          </p>
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
                        {p.isBanker && <BankerTag />}
                      </div>
                    ))}
                        {visible.length === 0 && (
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
              </FixtureRoundGroup>
            ))}
          </div>
        </>
      )}

      {open.length === 0 && locked.length === 0 && (
        <p className="text-center text-sm text-ink-muted">
          Settled rounds are on{" "}
          <Link href="/results" className="font-medium text-pitch hover:underline">
            Results
          </Link>
          .
        </p>
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
