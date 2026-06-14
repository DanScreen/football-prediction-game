"use client"

import { useActionState, useState } from "react"
import type { FetchProposalState, ConfirmImportState } from "./actions"
import type { ProposedFixture } from "@/lib/ai"

interface Props {
  aiEnabled: boolean
  fetchImportProposal: (prev: FetchProposalState, formData: FormData) => Promise<FetchProposalState>
  confirmImport: (prev: ConfirmImportState, formData: FormData) => Promise<ConfirmImportState>
}

type DeselectedState = {
  // ties the deselection to a specific proposal — resets automatically when a new proposal arrives
  forProposed: FetchProposalState["proposed"]
  indices: Set<number>
}

export default function ImportForm({ aiEnabled, fetchImportProposal, confirmImport }: Props) {
  const [fetchState, fetchAction, fetchPending] = useActionState(fetchImportProposal, {})
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmImport, {})
  const [deselectedState, setDeselectedState] = useState<DeselectedState>({
    forProposed: undefined,
    indices: new Set(),
  })

  const proposed = fetchState.proposed

  // Deselected set is valid only while it belongs to the current proposal.
  // When a new proposal arrives the set resets to empty (= all selected).
  const deselected =
    deselectedState.forProposed === proposed ? deselectedState.indices : new Set<number>()

  const toggle = (i: number) => {
    const next = new Set(deselected)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setDeselectedState({ forProposed: proposed, indices: next })
  }

  const selectedFixtures: ProposedFixture[] =
    proposed?.fixtures.filter((_, i) => !deselected.has(i)) ?? []

  return (
    <div className="space-y-6">
      {/* Step 1: AI fetch */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-4">1. Find Fixtures with AI</h2>
        <form action={fetchAction} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Competition</label>
            <input
              name="competition"
              placeholder="e.g. Premier League"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a7a3c]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Round</label>
            <input
              name="round"
              placeholder="e.g. Matchweek 30"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a7a3c]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Season</label>
            <input
              name="season"
              placeholder="e.g. 2025/26"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a7a3c]"
            />
          </div>
          {fetchState.error && <p className="text-red-600 text-sm">{fetchState.error}</p>}
          <button
            type="submit"
            disabled={fetchPending || !aiEnabled}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {fetchPending ? "Searching…" : "🔍 Find Fixtures"}
          </button>
        </form>
      </div>

      {/* Step 2: Review + confirm */}
      {proposed && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-1">2. Review & Import</h2>
          <p className="text-gray-500 text-sm mb-4">
            {proposed.competition} · {proposed.round} · {proposed.fixtures.length} fixture
            {proposed.fixtures.length !== 1 ? "s" : ""} found
          </p>

          <div className="space-y-2 mb-5">
            {proposed.fixtures.map((f, i) => (
              <label
                key={i}
                className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={!deselected.has(i)}
                  onChange={() => toggle(i)}
                  className="h-4 w-4 accent-[#1a7a3c]"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {f.homeTeam} vs {f.awayTeam}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(f.kickoffTime).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZoneName: "short",
                    })}
                  </p>
                </div>
              </label>
            ))}
          </div>

          {confirmState.error && (
            <p className="text-red-600 text-sm mb-3">{confirmState.error}</p>
          )}

          <form action={confirmAction}>
            <input type="hidden" name="competition" value={proposed.competition} />
            <input type="hidden" name="round" value={proposed.round} />
            <input type="hidden" name="fixtures" value={JSON.stringify(selectedFixtures)} />
            <button
              type="submit"
              disabled={confirmPending || selectedFixtures.length === 0}
              className="w-full bg-[#1a7a3c] text-white py-2 rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {confirmPending
                ? "Importing…"
                : `Import ${selectedFixtures.length} fixture${selectedFixtures.length !== 1 ? "s" : ""}`}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
