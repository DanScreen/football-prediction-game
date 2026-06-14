import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import Countdown from "@/app/components/Countdown"
import PredictionInput from "@/app/components/PredictionInput"

export default async function DashboardPage() {
  const session = await auth()
  const userId = session?.user?.id

  const now = new Date()
  const cutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

  const fixtures = await prisma.fixture.findMany({
    where: {
      status: { in: ["SCHEDULED", "AWAITING_RESULT"] },
      kickoffTime: { gte: cutoff },
    },
    orderBy: { kickoffTime: "asc" },
    include: {
      predictions: {
        include: { user: { select: { id: true, displayName: true, isBot: true } } },
      },
    },
  })

  const open = fixtures.filter((f) => new Date(f.kickoffTime) > now)
  const locked = fixtures.filter((f) => new Date(f.kickoffTime) <= now)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Open fixtures */}
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Upcoming Fixtures</h1>
      <p className="text-gray-500 text-sm mb-5">Submit your predictions before each kickoff.</p>

      {open.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-3">⚽</p>
          <p className="font-medium text-gray-600">No upcoming fixtures right now.</p>
          <p className="text-sm mt-1">Check back soon — the Commissioner will add matches shortly.</p>
        </div>
      ) : (
        <div className="space-y-3 mb-10">
          {open.map((f) => {
            const myPick = userId ? f.predictions.find((p) => p.userId === userId) : undefined
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

                {userId && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                    <span className="text-xs text-gray-500 font-medium">Your pick:</span>
                    <PredictionInput
                      fixtureId={f.id}
                      savedHome={myPick?.predictedHomeScore}
                      savedAway={myPick?.predictedAwayScore}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Locked fixtures — show others' picks */}
      {locked.length > 0 && (
        <>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Kicked Off</h2>
          <p className="text-gray-500 text-sm mb-4">Predictions locked — see what everyone picked.</p>
          <div className="space-y-3">
            {locked.map((f) => {
              const myPick = userId ? f.predictions.find((p) => p.userId === userId) : undefined
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
                    {!myPick && userId && (
                      <p className="text-xs text-gray-400 italic">You didn&apos;t submit a prediction.</p>
                    )}
                    {others.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="w-24 truncate">
                          {p.user.isBot ? "🤖 " : ""}{p.user.displayName}
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
