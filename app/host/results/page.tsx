import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { checkTransitions } from "./actions"
import { RESULT_DELAY_MS } from "@/lib/resolution"

export const metadata = { title: "Results Queue" }

export default async function HostResultsPage() {
  const now = new Date()
  const cutoff = new Date(now.getTime() - RESULT_DELAY_MS)

  const [awaitingFixtures, scheduledReadyCount] = await Promise.all([
    prisma.fixture.findMany({
      where: { status: "AWAITING_RESULT" },
      orderBy: { kickoffTime: "asc" },
      include: { competition: { select: { name: true, flag: true } } },
    }),
    prisma.fixture.count({
      where: { status: "SCHEDULED", kickoffTime: { lte: cutoff } },
    }),
  ])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <h1 className="text-2xl font-bold text-ink">Pending Results</h1>
        <form action={checkTransitions}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-ink-mid hover:bg-chip transition-colors"
          >
            Check for Updates
            {scheduledReadyCount > 0 && (
              <span className="bg-clock-tint text-clock rounded-full px-2 py-0.5 text-xs font-bold">
                {scheduledReadyCount}
              </span>
            )}
          </button>
        </form>
      </div>
      <p className="text-sm text-ink-muted mb-6">
        Results from football-data.org are confirmed automatically once available. Enter or
        edit a score manually when needed — changes re-score every prediction.
      </p>

      {awaitingFixtures.length === 0 ? (
        <div className="text-center py-16 text-ink-muted">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-medium">No fixtures awaiting results.</p>
          {scheduledReadyCount > 0 && (
            <p className="text-sm mt-2">
              {scheduledReadyCount} scheduled fixture{scheduledReadyCount !== 1 ? "s" : ""} may be
              ready — click &quot;Check for Updates&quot; to move them into the queue.
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
                    <p className="font-medium text-ink">
                      {f.competition.flag ? `${f.competition.flag} ` : ""}
                      {f.competition.name}
                    </p>
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
                    <Link
                      href={`/host/results/${f.id}`}
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

      <p className="mt-8 text-sm text-ink-muted">
        Need to fix a confirmed score?{" "}
        <Link href="/host/fixtures" className="font-medium text-pitch hover:underline">
          Edit from Fixtures
        </Link>
        .
      </p>
    </div>
  )
}
