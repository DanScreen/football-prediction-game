import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getActiveLeagueId } from "@/lib/activeLeague"
import { redirect } from "next/navigation"
import DeleteFixtureButton from "./DeleteFixtureButton"

export default async function AdminFixturesPage() {
  const leagueId = await getActiveLeagueId()
  if (!leagueId) redirect("/leagues")

  const fixtures = await prisma.fixture.findMany({
    where: { leagueId },
    orderBy: { kickoffTime: "asc" },
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fixtures</h1>
        <Link
          href="/admin/fixtures/new"
          className="bg-[#1a7a3c] text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-green-700 transition-colors"
        >
          + Add Fixture
        </Link>
      </div>

      {fixtures.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">⚽</p>
          <p className="font-medium">No fixtures yet.</p>
          <p className="text-sm mt-1">Add some fixtures to get the league started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Competition / Round</th>
                <th className="text-left px-4 py-3">Match</th>
                <th className="text-left px-4 py-3">Kickoff</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fixtures.map((f) => (
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
                  <td className="px-4 py-3">
                    <StatusBadge status={f.status} />
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <Link
                      href={`/admin/fixtures/${f.id}/edit`}
                      className="text-[#1a7a3c] hover:underline font-medium"
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
    SCHEDULED: { style: "bg-blue-100 text-blue-700", label: "📅 Scheduled" },
    AWAITING_RESULT: { style: "bg-yellow-100 text-yellow-700", label: "🟨 Awaiting Result" },
    COMPLETED: { style: "bg-green-100 text-green-700", label: "✅ Completed" },
  }
  const { style, label } = config[status] ?? { style: "bg-gray-100 text-gray-600", label: status }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>{label}</span>
  )
}
