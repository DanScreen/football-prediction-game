import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getActiveLeagueId } from "@/lib/activeLeague"
import { scoreOnePrediction } from "@/lib/scoring"

export default async function MyPredictionsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const activeLeagueId = await getActiveLeagueId()
  if (!activeLeagueId) redirect("/leagues")

  const [predictions, bonusAwards] = await Promise.all([
    prisma.prediction.findMany({
      where: {
        userId: session.user.id,
        fixture: { leagueId: activeLeagueId },
      },
      orderBy: { fixture: { kickoffTime: "desc" } },
      include: { fixture: true },
    }),
    prisma.bonusAward.findMany({
      where: { userId: session.user.id, leagueId: activeLeagueId },
    }),
  ])

  const bonusByRound = new Map(bonusAwards.map((b) => [`${b.competition}||${b.round}`, b.points]))

  // Group into rounds, preserving the newest-first ordering
  type Round = {
    key: string
    competition: string
    round: string
    predictions: typeof predictions
  }
  const rounds: Round[] = []
  const roundByKey = new Map<string, Round>()
  for (const p of predictions) {
    const key = `${p.fixture.competition}||${p.fixture.round}`
    let r = roundByKey.get(key)
    if (!r) {
      r = { key, competition: p.fixture.competition, round: p.fixture.round, predictions: [] }
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
    const bonus = bonusByRound.get(r.key) ?? 0
    return {
      ...r,
      scoredCount: scored.length,
      exactCount: scored.filter((s) => s === 3).length,
      subtotal: scored.reduce((a, b) => a + b, 0) + bonus,
      bonus,
    }
  })

  const totalPoints = roundStats.reduce((sum, r) => sum + r.subtotal, 0)
  const totalExact = roundStats.reduce((sum, r) => sum + r.exactCount, 0)
  const bestRound = roundStats
    .filter((r) => r.scoredCount > 0)
    .reduce<(typeof roundStats)[number] | null>(
      (best, r) => (best === null || r.subtotal > best.subtotal ? r : best),
      null,
    )

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Predictions</h1>
      <p className="text-gray-500 text-sm mb-6">Your full prediction history in this league.</p>

      {predictions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🎯</p>
          <p className="font-medium text-gray-600">No predictions yet.</p>
          <p className="text-sm mt-1">Head to the dashboard to submit your first pick.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 text-center">
              <p className="text-2xl font-bold text-gray-900 tabular-nums">{totalPoints}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total points</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 text-center">
              <p className="text-2xl font-bold text-gray-900 tabular-nums">{totalExact}</p>
              <p className="text-xs text-gray-500 mt-0.5">Exact ⚽</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 text-center">
              {bestRound ? (
                <>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">
                    {bestRound.subtotal}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate" title={bestRound.round}>
                    Best: {bestRound.round}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-gray-400">–</p>
                  <p className="text-xs text-gray-500 mt-0.5">Best round</p>
                </>
              )}
            </div>
          </div>

          <div className="space-y-8">
            {roundStats.map((r) => (
              <section key={r.key}>
                <div className="flex items-baseline justify-between mb-2 px-1">
                  <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                    {r.competition} · {r.round}
                  </h2>
                  {r.scoredCount > 0 && (
                    <p className="text-sm text-gray-500">
                      {r.bonus > 0 && (
                        <span className="text-amber-600 font-semibold mr-2">
                          🏆 Grand Slam +{r.bonus}
                        </span>
                      )}
                      <span className="font-bold text-gray-900 tabular-nums">{r.subtotal}</span>{" "}
                      pts
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  {r.predictions.map((p) => {
                    const f = p.fixture
                    const isCompleted = f.status === "COMPLETED"
                    const baseScore = baseScoreOf(p)

                    const accentBorder =
                      baseScore === 3
                        ? "border-l-green-500"
                        : baseScore === 0
                          ? "border-l-red-400"
                          : baseScore !== null
                            ? "border-l-blue-400"
                            : "border-l-gray-200"

                    return (
                      <div
                        key={p.id}
                        className={`bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 ${accentBorder} px-5 py-4`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 truncate">
                              {f.homeTeam}{" "}
                              <span className="text-gray-400 font-normal">vs</span>{" "}
                              {f.awayTeam}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {new Date(f.kickoffTime).toLocaleString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                          </div>

                          <div className="flex items-center gap-5 shrink-0">
                            <div>
                              <p className="text-xs text-gray-400 mb-0.5">My pick</p>
                              <p className="font-bold text-lg tabular-nums">
                                {p.predictedHomeScore} – {p.predictedAwayScore}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-400 mb-0.5">Result</p>
                              {isCompleted ? (
                                <p className="font-bold text-lg tabular-nums">
                                  {f.actualHomeScore} – {f.actualAwayScore}
                                </p>
                              ) : (
                                <p className="text-sm text-gray-400 italic">Pending</p>
                              )}
                            </div>

                            <div className="min-w-[3rem]">
                              <p className="text-xs text-gray-400 mb-0.5">Pts</p>
                              {isCompleted && baseScore !== null ? (
                                <div className="flex flex-col items-start gap-1">
                                  <PointsBadge points={baseScore} />
                                  {baseScore === 3 && (
                                    <span className="text-xs font-bold text-green-700 bg-green-100 border border-green-200 rounded-full px-2 py-0.5 animate-pop whitespace-nowrap">
                                      Nailed it! ⚽
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-400">–</p>
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
      ? "bg-green-100 text-green-700 border border-green-200"
      : points === 1.5
        ? "bg-blue-100 text-blue-700 border border-blue-200"
        : points === 1
          ? "bg-yellow-100 text-yellow-700 border border-yellow-200"
          : "bg-gray-100 text-gray-500 border border-gray-200"

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-sm font-bold ${color}`}>
      {points}
    </span>
  )
}
