import Link from "next/link"
import { fetchImportProposal, confirmImport } from "./actions"
import ImportForm from "./ImportForm"

export default function AdminImportPage() {
  const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Import Fixtures</h1>
      <p className="text-gray-500 text-sm mb-6">
        Ask Claude to find upcoming fixtures for a competition and round, then confirm before
        inserting.
      </p>

      {!aiEnabled && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-6 text-sm text-yellow-800">
          <strong>ANTHROPIC_API_KEY not set.</strong> AI import is unavailable. Add fixtures
          manually from the{" "}
          <Link href="/admin/fixtures" className="underline">
            Fixtures
          </Link>{" "}
          page.
        </div>
      )}

      <ImportForm
        aiEnabled={aiEnabled}
        fetchImportProposal={fetchImportProposal}
        confirmImport={confirmImport}
      />
    </div>
  )
}
