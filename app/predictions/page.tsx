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

  const predictions = await prisma.prediction.findMany({
    where: {
      userId: session.user.id,
      fixture: { leagueId: activeLeagueId },
    },
    orderBy: { fixture: { kickoffTime: "desc" } },
    include: { fixture: true },
  })

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
        <div className="space-y-2">
          {predictions.map((p) => {
            const f = p.fixture
            const isCompleted = f.status === "COMPLETED"
            const baseScore =
              isCompleted && f.actualHomeScore !== null && f.actualAwayScore !== null
                ? scoreOnePrediction(
                    p.predictedHomeScore,
                    p.predictedAwayScore,
                    f.actualHomeScore,
                    f.actualAwayScore,
                  )
                : null

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
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">
                      {f.competition} · {f.round}
                    </p>
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
                      {isCompleted && p.pointsAwarded !== null ? (
                        <div className="flex flex-col items-start gap-1">
                          <PointsBadge points={baseScore ?? p.pointsAwarded} />
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
