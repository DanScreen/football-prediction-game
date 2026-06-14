import { prisma } from "@/lib/prisma"
import Countdown from "@/app/components/Countdown"

export default async function DashboardPage() {
  const fixtures = await prisma.fixture.findMany({
    where: { status: "SCHEDULED" },
    orderBy: { kickoffTime: "asc" },
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Upcoming Fixtures</h1>
      <p className="text-gray-500 text-sm mb-6">Submit your predictions before each kickoff.</p>

      {fixtures.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-4">⚽</p>
          <p className="font-medium text-gray-600">No upcoming fixtures yet.</p>
          <p className="text-sm mt-1">Check back soon — the Commissioner will add matches shortly.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {fixtures.map((f) => (
            <div
              key={f.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
                  {f.competition} · {f.round}
                </p>
                <p className="text-lg font-bold text-gray-900 truncate">
                  {f.homeTeam} <span className="text-gray-400 font-normal">vs</span> {f.awayTeam}
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
                <p className="text-xs text-gray-400 mt-1">until deadline</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
