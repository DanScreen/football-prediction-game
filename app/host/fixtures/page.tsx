import Link from "next/link"
import { prisma } from "@/lib/prisma"
import DeleteFixtureButton from "./DeleteFixtureButton"

export const metadata = { title: "Fixtures" }

export default async function HostFixturesPage() {
  const fixtures = await prisma.fixture.findMany({
    orderBy: { kickoffTime: "asc" },
    include: { competition: { select: { name: true, flag: true } } },
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink">Fixtures</h1>
        <Link
          href="/host/fixtures/new"
          className="bg-pitch text-pitch-on px-4 py-2 rounded-lg font-semibold text-sm hover:bg-pitch-deep transition-colors"
        >
          + Add Fixture
        </Link>
      </div>

      {fixtures.length === 0 ? (
        <div className="text-center py-16 text-ink-muted">
          <p className="text-4xl mb-3">⚽</p>
          <p className="font-medium">No fixtures yet.</p>
          <p className="text-sm mt-1">
            The cron sweep imports upcoming rounds automatically, or use{" "}
            <Link href="/host/import" className="text-pitch hover:underline">
              Import
            </Link>{" "}
            to pull them now.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-ground text-ink-muted uppercase text-xs tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Competition / Round</th>
                <th className="text-left px-4 py-3">Match</th>
                <th className="text-left px-4 py-3">Kickoff</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {fixtures.map((f) => (
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
                  <td className="px-4 py-3">
                    <StatusBadge status={f.status} />
                    {f.status === "COMPLETED" &&
                      f.actualHomeScore !== null &&
                      f.actualAwayScore !== null && (
                        <p className="text-xs text-ink-muted mt-1 score-digits">
                          {f.actualHomeScore}–{f.actualAwayScore}
                        </p>
                      )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    {f.status === "COMPLETED" && (
                      <Link
                        href={`/host/results/${f.id}`}
                        className="text-pitch hover:underline font-medium"
                      >
                        Edit result
                      </Link>
                    )}
                    {f.status === "AWAITING_RESULT" && (
                      <Link
                        href={`/host/results/${f.id}`}
                        className="text-pitch hover:underline font-medium"
                      >
                        Enter result
                      </Link>
                    )}
                    <Link
                      href={`/host/fixtures/${f.id}/edit`}
                      className="text-pitch hover:underline font-medium"
                    >
                      Edit
                    </Link>
                    <DeleteFixtureButton id={f.id} label={`${f.homeTeam} vs ${f.awayTeam}`} />
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

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { style: string; label: string }> = {
    SCHEDULED: { style: "bg-info-tint text-info", label: "📅 Scheduled" },
    AWAITING_RESULT: { style: "bg-clock-tint text-clock", label: "🟨 Awaiting Result" },
    COMPLETED: { style: "bg-good-tint text-good", label: "✅ Completed" },
  }
  const { style, label } = config[status] ?? { style: "bg-chip text-ink-muted", label: status }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>{label}</span>
  )
}
