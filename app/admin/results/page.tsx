import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getActiveLeagueId } from "@/lib/activeLeague"
import { redirect } from "next/navigation"
import { checkTransitions } from "./actions"
import { RESULT_DELAY_MS } from "@/lib/resolution"

export default async function AdminResultsPage() {
  const leagueId = await getActiveLeagueId()
  if (!leagueId) redirect("/leagues")

  const now = new Date()
  const cutoff = new Date(now.getTime() - RESULT_DELAY_MS)

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
        <h1 className="text-2xl font-bold text-ink">Pending Results</h1>
        <form action={checkTransitions}>
          <button
            type="submit"
            className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-yellow-600 transition-colors"
          >
            Check for Updates
            {scheduledReadyCount > 0 && (
              <span className="bg-surface text-yellow-700 rounded-full px-2 py-0.5 text-xs font-bold">
                {scheduledReadyCount}
              </span>
            )}
          </button>
        </form>
      </div>

      {awaitingFixtures.length === 0 ? (
        <div className="text-center py-16 text-ink-muted">
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
        <div className="overflow-x-auto rounded-xl border border-line shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-ground text-ink-muted uppercase text-xs tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Competition / Round</th>
                <th className="text-left px-4 py-3">Match</th>
                <th className="text-left px-4 py-3">Kicked off</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {awaitingFixtures.map((f) => (
                <tr key={f.id} className="hover:bg-ground transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{f.competition}</p>
                    <p className="text-ink-muted text-xs">{f.round}</p>
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">
                    {f.homeTeam} <span className="text-ink-faint mx-1">vs</span> {f.awayTeam}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {new Date(f.kickoffTime).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {f.proposedHomeScore !== null && f.proposedAwayScore !== null && (
                      <span className="mr-3 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                        ✓ {f.proposedHomeScore}–{f.proposedAwayScore} found
                      </span>
                    )}
                    <Link
                      href={`/admin/results/${f.id}`}
                      className="text-pitch hover:underline font-medium"
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
