"use client"

import { useActionState, useState } from "react"
import type { FetchProposalState, ConfirmImportState } from "./actions"
import type { ProposedFixture } from "@/lib/footballData"

interface Props {
  competitions: { id: string; name: string; flag: string }[]
  apiEnabled: boolean
  fetchImportProposal: (prev: FetchProposalState, formData: FormData) => Promise<FetchProposalState>
  confirmImport: (prev: ConfirmImportState, formData: FormData) => Promise<ConfirmImportState>
}

type DeselectedState = {
  forProposed: FetchProposalState["proposed"]
  indices: Set<number>
}

const ROUNDS_OPTIONS = [1, 2, 3] as const

export default function ImportForm({
  competitions,
  apiEnabled,
  fetchImportProposal,
  confirmImport,
}: Props) {
  const [fetchState, fetchAction, fetchPending] = useActionState(fetchImportProposal, {})
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmImport, {})
  const [deselectedState, setDeselectedState] = useState<DeselectedState>({
    forProposed: undefined,
    indices: new Set(),
  })
  const [rounds, setRounds] = useState(1)

  const proposed = fetchState.proposed

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
      <div className="bg-surface border border-line rounded-xl p-5">
        <h2 className="font-semibold text-ink mb-4">1. Find Fixtures</h2>

        <form action={fetchAction} className="space-y-4">
          <input type="hidden" name="rounds" value={rounds} />

          <div>
            <label className="block text-sm font-medium text-ink-mid mb-1">Competition</label>
            <select
              name="competitionId"
              required
              className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-pitch"
            >
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.flag ? `${c.flag} ` : ""}{c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-mid mb-2">Rounds to fetch</label>
            <div className="flex gap-2">
              {ROUNDS_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRounds(n)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    rounds === n
                      ? "bg-pitch text-pitch-on border-pitch"
                      : "bg-surface text-ink-mid border-line-strong hover:border-ink-faint"
                  }`}
                >
                  {n === 1 ? "1 round" : `${n} rounds`}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-faint mt-1.5">
              Fetches upcoming unplayed fixtures for the current season
            </p>
          </div>

          {fetchState.error && <p className="text-bad text-sm">{fetchState.error}</p>}

          <button
            type="submit"
            disabled={fetchPending || !apiEnabled}
            className="w-full bg-board-panel text-board-fore py-2 rounded-lg font-semibold text-sm hover:bg-board disabled:opacity-50 transition-colors"
          >
            {fetchPending ? "Fetching…" : "Fetch Fixtures"}
          </button>
        </form>
      </div>

      {/* Step 2: Review + confirm */}
      {proposed && (
        <div className="bg-surface border border-line rounded-xl p-5">
          <h2 className="font-semibold text-ink mb-1">2. Review & Import</h2>
          <p className="text-ink-muted text-sm mb-4">
            {proposed.competition} · {proposed.fixtures.length} fixture
            {proposed.fixtures.length !== 1 ? "s" : ""} found — deselect any to skip
          </p>

          <div className="space-y-2 mb-5 max-h-80 overflow-y-auto">
            {proposed.fixtures.map((f, i) => (
              <label
                key={i}
                className="flex items-center gap-3 p-3 border border-line-soft rounded-lg hover:bg-ground cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={!deselected.has(i)}
                  onChange={() => toggle(i)}
                  className="h-4 w-4 accent-pitch"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {f.homeTeam} vs {f.awayTeam}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {f.round && <span className="mr-2 font-medium">{f.round}</span>}
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
            <p className="text-bad text-sm mb-3">{confirmState.error}</p>
          )}

          <form action={confirmAction}>
            <input type="hidden" name="competitionId" value={proposed.competitionId} />
            <input type="hidden" name="fixtures" value={JSON.stringify(selectedFixtures)} />
            <button
              type="submit"
              disabled={confirmPending || selectedFixtures.length === 0}
              className="w-full bg-pitch text-pitch-on py-2 rounded-lg font-semibold text-sm hover:bg-pitch disabled:opacity-50 transition-colors"
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
