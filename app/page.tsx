import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import Countdown from "@/app/components/Countdown"
import PredictionInput from "@/app/components/PredictionInput"
import BankerButton from "@/app/components/BankerButton"
import BankerTag from "@/app/components/BankerTag"
import RequestResultButton from "@/app/components/RequestResultButton"
import { RESULT_DELAY_MS } from "@/lib/resolution"
import { provisionalPoints } from "@/lib/provisional"
import PredictionHistory, { type HistoryPrediction } from "@/app/PredictionHistory"
import FixtureRoundGroup, { groupByRound } from "@/app/FixtureRoundGroup"

/**
 * Predictions — the single home for a player's picks.
 *
 * Deliberately scoped by **competition, not league**. A prediction is unique per
 * (user, fixture) and counts in every league the user has on that competition, so
 * showing this page per-league would render the same fixtures and the same inputs
 * once per league. Leagues only decide *whose* picks you see alongside yours, and
 * who you're ranked against — which is the Leaderboard's job.
 */
export default async function PredictionsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const memberships = await prisma.leagueMembership.findMany({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    select: {
      leagueId: true,
      league: {
        select: { competitionId: true, competition: { select: { id: true, name: true } } },
      },
    },
  })

  if (memberships.length === 0) {
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

  const myLeagueIds = memberships.map((m) => m.leagueId)
  const leagueToCompetition = new Map(memberships.map((m) => [m.leagueId, m.league.competitionId]))
  const competitionIds = [...new Set(memberships.map((m) => m.league.competitionId))]
  const multipleCompetitions = competitionIds.length > 1

  // Who you see picks from: everyone sharing a league with you, per competition.
  // A league-mate on the World Cup shouldn't surface on your Premier League fixtures.
  const coMemberships = await prisma.leagueMembership.findMany({
    where: { leagueId: { in: myLeagueIds } },
    select: { leagueId: true, userId: true },
  })
  const peersByCompetition = new Map<string, Set<string>>()
  for (const m of coMemberships) {
    const competitionId = leagueToCompetition.get(m.leagueId)
    if (!competitionId) continue
    const set = peersByCompetition.get(competitionId) ?? new Set<string>()
    set.add(m.userId)
    peersByCompetition.set(competitionId, set)
  }
  const allPeerIds = [...new Set(coMemberships.map((m) => m.userId))]

  const now = new Date()
  const cutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

  const [liveFixtures, myPredictions, bonusAwards] = await Promise.all([
    prisma.fixture.findMany({
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
    }),
    prisma.prediction.findMany({
      where: { userId, fixture: { competitionId: { in: competitionIds } } },
      orderBy: { fixture: { kickoffTime: "desc" } },
      include: { fixture: { include: { competition: { select: { name: true } } } } },
    }),
    prisma.bonusAward.findMany({
      where: { userId, leagueId: { in: myLeagueIds } },
      select: { leagueId: true, round: true, points: true },
    }),
  ])

  const open = liveFixtures.filter((f) => f.kickoffTime > now)
  const locked = liveFixtures.filter((f) => f.kickoffTime <= now)
  const liveIds = new Set(liveFixtures.map((f) => f.id))

  /**
   * The banker is one pick per (competition, round), but a round's fixtures
   * straddle the Open / Kicked Off split as they go off — so resolve it across
   * every live fixture rather than per list, or an Open group would report "no
   * banker yet" when the banker simply sits on a match that has started.
   * Keyed to match `groupByRound`.
   */
  const bankerByRound = new Map<string, { homeTeam: string; awayTeam: string }>()
  for (const f of liveFixtures) {
    if (f.predictions.some((p) => p.userId === userId && p.isBanker)) {
      bankerByRound.set(`${f.competitionId}·${f.round}`, {
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
      })
    }
  }
  const bankerOf = (group: { key: string }) => bankerByRound.get(group.key) ?? null

  // History is everything not already shown in the live sections above.
  const history: HistoryPrediction[] = myPredictions.filter((p) => !liveIds.has(p.fixtureId))

  // Grand Slam bonuses keyed to match PredictionHistory's competition·round key.
  const competitionNameById = new Map(memberships.map((m) => [m.league.competition.id, m.league.competition.name]))
  const bonusByRound = new Map<string, number>()
  for (const b of bonusAwards) {
    const competitionId = leagueToCompetition.get(b.leagueId)
    const name = competitionId ? competitionNameById.get(competitionId) : undefined
    if (!name) continue
    const key = `${name}·${b.round}`
    bonusByRound.set(key, (bonusByRound.get(key) ?? 0) + b.points)
  }

  // Gameweeks, nearest first (both lists are already ordered by kickoff).
  const openRounds = groupByRound(open)
  const lockedRounds = groupByRound(locked)

  /**
   * The nudge counts only the *next* gameweek needing picks in each competition —
   * not everything open. Fixtures import a couple of rounds ahead, so counting all
   * of them said "20 fixtures still to predict" for deadlines a fortnight out:
   * alarming, and not something you can usefully act on in one sitting. Each
   * gameweek header carries its own "N to predict" badge for the rest.
   */
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
  // Groups are ordered by kickoff, but two competitions' groups interleave.
  const nextDeadline = missing.reduce<Date | null>(
    (soonest, f) => (soonest === null || f.kickoffTime < soonest ? f.kickoffTime : soonest),
    null,
  )

  /**
   * Open the nearest gameweek that still needs picks; if everything's predicted,
   * just open the first. Anything further out stays collapsed — a full Premier
   * League round is 10 fixtures, so several rounds expanded is an unusable page.
   */
  const firstUnfinishedRound = openRounds.findIndex((g) =>
    g.fixtures.some((f) => !f.predictions.some((p) => p.userId === userId)),
  )
  const expandedRound = firstUnfinishedRound === -1 ? 0 : firstUnfinishedRound

  /**
   * Kickoff only. The competition and round used to be repeated here, but the
   * gameweek header above the card now states both.
   */
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

      {missing.length > 0 && nextDeadline && (
        <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-clock-line bg-clock-tint px-4 py-3">
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

      {/* ── Open ── */}
      <h2 className="text-lg font-bold text-ink mb-1">Open</h2>
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
              <div
                key={f.id}
                // An amber left edge marks every fixture still needing a pick —
                // a superset of the nudge, which only counts the next gameweek.
                className={`bg-surface rounded-xl border shadow-card overflow-hidden border-l-4 ${
                  myPick ? "border-line border-l-pitch/40" : "border-clock-line border-l-clock"
                }`}
              >
                <div className="flex items-center justify-between gap-4 border-b border-line-soft px-5 py-2.5">
                  <p className="min-w-0 truncate text-xs font-medium text-ink-muted">
                    {fixtureMeta(f)}
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

                {/* Its own row rather than the header: a banker error can run to a
                    full sentence, and the header has the countdown to protect. */}
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft px-5 py-2">
                  <BankerButton
                    fixtureId={f.id}
                    isBanker={myPick?.isBanker ?? false}
                    hasPrediction={Boolean(myPick)}
                  />
                </div>
              </div>
            )
          })}
            </FixtureRoundGroup>
          ))}
        </div>
      )}

      {/* ── Kicked off ── */}
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
                    {myPick ? (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-pitch font-semibold w-24 truncate">You</span>
                        <span className="font-bold tabular-nums">
                          {myPick.predictedHomeScore} – {myPick.predictedAwayScore}
                        </span>
                        {myPick.isBanker && <BankerTag />}
                        {provisionalPoints(myPick, f) !== null && (
                          <span className="rounded-md bg-clock-tint px-1.5 py-0.5 text-xs font-semibold text-clock">
                            +{provisionalPoints(myPick, f)} prov.
                          </span>
                        )}
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
                        {provisionalPoints(p, f) !== null && (
                          <span className="rounded-md bg-clock-tint px-1.5 py-0.5 text-xs font-medium text-clock">
                            +{provisionalPoints(p, f)}
                          </span>
                        )}
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

      {/* ── History ── */}
      {history.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-ink mb-1">Results</h2>
          <p className="text-ink-muted text-sm mb-4">Your settled picks, newest round first.</p>
          <PredictionHistory predictions={history} bonusByRound={bonusByRound} />
        </>
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
