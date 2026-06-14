import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"

export default async function MyPredictionsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const predictions = await prisma.prediction.findMany({
    where: { userId: session.user.id },
    orderBy: { fixture: { kickoffTime: "desc" } },
    include: { fixture: true },
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Predictions</h1>
      <p className="text-gray-500 text-sm mb-6">Your full prediction history.</p>

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
            const points = p.pointsAwarded

            return (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">
                    {f.competition} · {f.round}
                  </p>
                  <p className="font-bold text-gray-900 truncate">
                    {f.homeTeam} <span className="text-gray-400 font-normal">vs</span> {f.awayTeam}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(f.kickoffTime).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-6 shrink-0 text-right">
                  {/* My pick */}
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">My pick</p>
                    <p className="font-bold text-lg tabular-nums">
                      {p.predictedHomeScore} – {p.predictedAwayScore}
                    </p>
                  </div>

                  {/* Result */}
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

                  {/* Points */}
                  <div className="w-12">
                    <p className="text-xs text-gray-400 mb-0.5">Pts</p>
                    {isCompleted && points !== null ? (
                      <PointsBadge points={points} />
                    ) : (
                      <p className="text-sm text-gray-400">–</p>
                    )}
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
      ? "bg-green-100 text-green-700"
      : points === 1.5
        ? "bg-blue-100 text-blue-700"
        : points === 1
          ? "bg-yellow-100 text-yellow-700"
          : "bg-gray-100 text-gray-500"

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-sm font-bold ${color}`}>
      {points}
    </span>
  )
}
