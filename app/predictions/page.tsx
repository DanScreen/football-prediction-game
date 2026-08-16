import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getActiveLeagueId } from "@/lib/activeLeague"
import { scoreOnePrediction } from "@/lib/scoring"
import { provisionalScore, provisionalPoints } from "@/lib/provisional"

export const metadata = { title: "My Predictions" }

export default async function MyPredictionsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const activeLeagueId = await getActiveLeagueId()
  if (!activeLeagueId) redirect("/leagues")

  const league = await prisma.league.findUnique({
    where: { id: activeLeagueId },
    select: { competitionId: true, competition: { select: { name: true } } },
  })
  if (!league) redirect("/leagues")
  const competitionName = league.competition.name

  const [predictions, bonusAwards] = await Promise.all([
    prisma.prediction.findMany({
      where: {
        userId: session.user.id,
        fixture: { competitionId: league.competitionId },
      },
      orderBy: { fixture: { kickoffTime: "desc" } },
      include: { fixture: true },
    }),
    prisma.bonusAward.findMany({
      where: { userId: session.user.id, leagueId: activeLeagueId },
    }),
  ])

  const bonusByRound = new Map(bonusAwards.map((b) => [b.round, b.points]))

  // Group into rounds, preserving the newest-first ordering
  type Round = {
    key: string
    round: string
    predictions: typeof predictions
  }
  const rounds: Round[] = []
  const roundByKey = new Map<string, Round>()
  for (const p of predictions) {
    const key = p.fixture.round
    let r = roundByKey.get(key)
    if (!r) {
      r = { key, round: p.fixture.round, predictions: [] }
      roundByKey.set(key, r)
      rounds.push(r)
    }
    r.predictions.push(p)
  }

  const baseScoreOf = (p: (typeof predictions)[number]) => {
    const f = p.fixture
    return f.status === "COMPLETED" && f.actualHomeScore !== null && f.actualAwayScore !== null
      ? scoreOnePrediction(
          p.predictedHomeScore,
          p.predictedAwayScore,
          f.actualHomeScore,
          f.actualAwayScore,
        )
      : null
  }

  const roundStats = rounds.map((r) => {
    const scored = r.predictions.map(baseScoreOf).filter((s): s is number => s !== null)
    const provisional = r.predictions
      .map((p) => provisionalPoints(p, p.fixture))
      .filter((s): s is number => s !== null)
    const bonus = bonusByRound.get(r.key) ?? 0
    return {
      ...r,
      scoredCount: scored.length,
      exactCount: scored.filter((s) => s === 3).length,
      subtotal: scored.reduce((a, b) => a + b, 0) + bonus,
      provisionalSubtotal: provisional.reduce((a, b) => a + b, 0),
      bonus,
    }
  })

  const totalPoints = roundStats.reduce((sum, r) => sum + r.subtotal, 0)
  const totalProvisional = roundStats.reduce((sum, r) => sum + r.provisionalSubtotal, 0)
  const totalExact = roundStats.reduce((sum, r) => sum + r.exactCount, 0)
  const bestRound = roundStats
    .filter((r) => r.scoredCount > 0)
    .reduce<(typeof roundStats)[number] | null>(
      (best, r) => (best === null || r.subtotal > best.subtotal ? r : best),
      null,
    )

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink mb-1">My Predictions</h1>
      <p className="text-ink-muted text-sm mb-6">Your full prediction history in this league.</p>

      {predictions.length === 0 ? (
        <div className="text-center py-16 text-ink-faint">
          <p className="text-4xl mb-3">🎯</p>
          <p className="font-medium text-ink-muted">No predictions yet.</p>
          <p className="text-sm mt-1">Head to the dashboard to submit your first pick.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="bg-surface rounded-xl border border-line shadow-card px-4 py-3 text-center">
              <p className="score-digits text-2xl text-ink">{totalPoints}</p>
              <p className="text-xs text-ink-muted mt-0.5">Total points</p>
              {totalProvisional > 0 && (
                <p className="text-xs font-semibold text-clock mt-0.5">
                  +{totalProvisional} prov.
                </p>
              )}
            </div>
            <div className="bg-surface rounded-xl border border-line shadow-card px-4 py-3 text-center">
              <p className="score-digits text-2xl text-ink">{totalExact}</p>
              <p className="text-xs text-ink-muted mt-0.5">Exact ⚽</p>
            </div>
            <div className="bg-surface rounded-xl border border-line shadow-card px-4 py-3 text-center">
              {bestRound ? (
                <>
                  <p className="score-digits text-2xl text-ink">
                    {bestRound.subtotal}
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5 truncate" title={bestRound.round}>
                    Best: {bestRound.round}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-ink-faint">–</p>
                  <p className="text-xs text-ink-muted mt-0.5">Best round</p>
                </>
              )}
            </div>
          </div>

          <div className="space-y-8">
            {roundStats.map((r) => (
              <section key={r.key}>
                <div className="flex items-baseline justify-between mb-2 px-1">
                  <h2 className="text-sm font-bold text-ink-mid uppercase tracking-wide">
                    {competitionName} · {r.round}
                  </h2>
                  {r.scoredCount > 0 ? (
                    <p className="text-sm text-ink-muted">
                      {r.bonus > 0 && (
                        <span className="text-clock font-semibold mr-2">
                          🏆 Grand Slam +{r.bonus}
                        </span>
                      )}
                      <span className="font-bold text-ink tabular-nums">{r.subtotal}</span>{" "}
                      pts
                    </p>
                  ) : (
                    r.provisionalSubtotal > 0 && (
                      <p className="text-sm text-clock font-semibold tabular-nums">
                        {r.provisionalSubtotal} pts prov.
                      </p>
                    )
                  )}
                </div>

                <div className="space-y-2">
                  {r.predictions.map((p) => {
                    const f = p.fixture
                    const isCompleted = f.status === "COMPLETED"
                    const baseScore = baseScoreOf(p)
                    const provScore = provisionalScore(f)
                    const provPts = provisionalPoints(p, f)

                    const accentBorder =
                      baseScore === 3
                        ? "border-l-green-500"
                        : baseScore === 0
                          ? "border-l-red-400"
                          : baseScore !== null
                            ? "border-l-blue-400"
                            : provScore !== null
                              ? "border-l-clock"
                              : "border-l-line-strong"

                    return (
                      <div
                        key={p.id}
                        className={`bg-surface rounded-xl shadow-card border border-line border-l-4 ${accentBorder} px-5 py-4`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-ink truncate">
                              {f.homeTeam}{" "}
                              <span className="text-ink-faint font-normal">vs</span>{" "}
                              {f.awayTeam}
                            </p>
                            <p className="text-xs text-ink-muted mt-0.5">
                              {new Date(f.kickoffTime).toLocaleString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                          </div>

                          <div className="flex items-center gap-5 shrink-0">
                            <div>
                              <p className="text-xs text-ink-faint mb-0.5">My pick</p>
                              <p className="score-digits text-lg">
                                {p.predictedHomeScore} – {p.predictedAwayScore}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-ink-faint mb-0.5">Result</p>
                              {isCompleted ? (
                                <p className="score-digits text-lg">
                                  {f.actualHomeScore} – {f.actualAwayScore}
                                </p>
                              ) : provScore !== null ? (
                                <div>
                                  <p className="score-digits text-lg text-clock">
                                    {provScore.home} – {provScore.away}
                                  </p>
                                  <p className="text-[10px] font-semibold text-clock uppercase tracking-wide -mt-0.5">
                                    Provisional
                                  </p>
                                </div>
                              ) : (
                                <p className="text-sm text-ink-faint italic">Pending</p>
                              )}
                            </div>

                            <div className="min-w-[3rem]">
                              <p className="text-xs text-ink-faint mb-0.5">Pts</p>
                              {isCompleted && baseScore !== null ? (
                                <div className="flex flex-col items-start gap-1">
                                  <PointsBadge points={baseScore} />
                                  {baseScore === 3 && (
                                    <span className="text-xs font-bold text-good bg-good-tint border border-good-line rounded-full px-2 py-0.5 animate-pop whitespace-nowrap">
                                      Nailed it! ⚽
                                    </span>
                                  )}
                                </div>
                              ) : provPts !== null ? (
                                <span className="inline-block px-2 py-0.5 rounded-full text-sm font-bold bg-clock-tint text-clock border border-clock/25">
                                  {provPts}
                                </span>
                              ) : (
                                <p className="text-sm text-ink-faint">–</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function PointsBadge({ points }: { points: number }) {
  const color =
    points === 3
      ? "bg-good-tint text-good border border-good-line"
      : points === 1.5
        ? "bg-info-tint text-info border border-info-line"
        : points === 1
          ? "bg-clock-tint text-clock border border-clock-line"
          : "bg-chip text-ink-muted border border-line"

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-sm font-bold ${color}`}>
      {points}
    </span>
  )
}
