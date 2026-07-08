import Link from "next/link"
import { fetchImportProposal, confirmImport } from "./actions"
import ImportForm from "./ImportForm"
import { prisma } from "@/lib/prisma"
import { getActiveLeagueId } from "@/lib/activeLeague"

export default async function AdminImportPage() {
  const apiEnabled = Boolean(process.env.FOOTBALL_DATA_API_KEY)

  const activeLeagueId = await getActiveLeagueId()
  const league = activeLeagueId
    ? await prisma.league.findUnique({ where: { id: activeLeagueId } })
    : null
  const leagueCompetition = league?.competition ?? ""

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink mb-2">Import Fixtures</h1>
      <p className="text-ink-muted text-sm mb-6">
        Fetch upcoming fixtures from football-data.org and confirm before inserting.
      </p>

      {!apiEnabled && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-6 text-sm text-yellow-800">
          <strong>FOOTBALL_DATA_API_KEY not set.</strong> Add your free API key from{" "}
          <span className="font-mono">football-data.org</span> to <span className="font-mono">.env.local</span>,
          or add fixtures manually from the{" "}
          <Link href="/admin/fixtures" className="underline">
            Fixtures
          </Link>{" "}
          page.
        </div>
      )}

      <ImportForm
        leagueCompetition={leagueCompetition}
        apiEnabled={apiEnabled}
        fetchImportProposal={fetchImportProposal}
        confirmImport={confirmImport}
      />
    </div>
  )
}
