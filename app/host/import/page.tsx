import Link from "next/link"
import { fetchImportProposal, confirmImport } from "./actions"
import ImportForm from "./ImportForm"
import { prisma } from "@/lib/prisma"

export const metadata = { title: "Import Fixtures" }

export default async function HostImportPage() {
  const apiEnabled = Boolean(process.env.FOOTBALL_DATA_API_KEY)

  const competitions = await prisma.competition.findMany({
    where: { isActive: true, archivedAt: null, code: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, flag: true },
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink mb-2">Import Fixtures</h1>
      <p className="text-ink-muted text-sm mb-6">
        Manual override for the automatic sweep — fetch upcoming fixtures from football-data.org
        and confirm before inserting. Duplicates are skipped automatically.
      </p>

      {!apiEnabled && (
        <div className="bg-clock-tint border border-clock-line rounded-lg px-4 py-3 mb-6 text-sm text-clock">
          <strong>FOOTBALL_DATA_API_KEY not set.</strong> Add your free API key from{" "}
          <span className="font-mono">football-data.org</span> to <span className="font-mono">.env.local</span>,
          or add fixtures manually from the{" "}
          <Link href="/host/fixtures" className="underline">
            Fixtures
          </Link>{" "}
          page.
        </div>
      )}

      <ImportForm
        competitions={competitions}
        apiEnabled={apiEnabled}
        fetchImportProposal={fetchImportProposal}
        confirmImport={confirmImport}
      />
    </div>
  )
}
