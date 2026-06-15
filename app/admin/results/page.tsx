import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getActiveLeagueId } from "@/lib/activeLeague"
import { redirect } from "next/navigation"
import { checkTransitions } from "./actions"

export default async function AdminResultsPage() {
  const leagueId = await getActiveLeagueId()
  if (!leagueId) redirect("/leagues")

  const now = new Date()
  const cutoff = new Date(now.getTime() - 2.5 * 60 * 60 * 1000)

  const [awaitingFixtures, scheduledReadyCount] = await Promise.all([
    prisma.fixture.findMany({
      where: { leagueId, status: "AWAITING_RESULT" },
      orderBy: { kickoffTime: "asc" },
    }),
    prisma.fixture.count({
      where: { leagueId, status: "SCHEDULED", kickoffTime: { lte: cutoff } },
    }),
  ])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pending Results</h1>
        <form action={checkTransitions}>
          <button
            type="submit"
            className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-yellow-600 transition-colors"
          >
            Check for Updates
            {scheduledReadyCount > 0 && (
              <span className="bg-white text-yellow-700 rounded-full px-2 py-0.5 text-xs font-bold">
                {scheduledReadyCount}
              </span>
            )}
          </button>
        </form>
      </div>

      {awaitingFixtures.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-medium">No fixtures awaiting results.</p>
          {scheduledReadyCount > 0 && (
            <p className="text-sm mt-2">
              {scheduledReadyCount} scheduled fixture{scheduledReadyCount !== 1 ? "s" : ""} may be
              ready — click &quot;Check for Updates&quot; to move them to this queue.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Competition / Round</th>
                <th className="text-left px-4 py-3">Match</th>
                <th className="text-left px-4 py-3">Kicked off</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {awaitingFixtures.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{f.competition}</p>
                    <p className="text-gray-500 text-xs">{f.round}</p>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {f.homeTeam} <span className="text-gray-400 mx-1">vs</span> {f.awayTeam}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(f.kickoffTime).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/results/${f.id}`}
                      className="text-[#1a7a3c] hover:underline font-medium"
                    >
                      Enter Result →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
