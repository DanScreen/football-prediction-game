"use client"

import { useActionState } from "react"
import type { ResultFormState } from "../actions"

interface Props {
  fixtureId: string
  homeTeam: string
  awayTeam: string
  apiEnabled: boolean
  initialHome: number | null
  initialAway: number | null
  editing: boolean
  lookupAndConfirmResult: (prev: ResultFormState, formData: FormData) => Promise<ResultFormState>
  confirmResult: (prev: ResultFormState, formData: FormData) => Promise<ResultFormState>
}

export default function ConfirmResultForm({
  fixtureId,
  homeTeam,
  awayTeam,
  apiEnabled,
  initialHome,
  initialAway,
  editing,
  lookupAndConfirmResult,
  confirmResult,
}: Props) {
  const [lookupState, lookupAction, lookupPending] = useActionState(lookupAndConfirmResult, {})
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmResult, {})

  return (
    <div className="space-y-4">
      {apiEnabled && (
        <div className="bg-info-tint border border-info-line rounded-xl p-5">
          <h2 className="font-semibold text-info mb-3">Result Lookup</h2>
          {lookupState.error && <p className="text-bad text-sm mb-3">{lookupState.error}</p>}
          <form action={lookupAction}>
            <input type="hidden" name="fixtureId" value={fixtureId} />
            <button
              type="submit"
              disabled={lookupPending}
              className="w-full bg-board-panel text-board-fore py-2 rounded-lg font-semibold text-sm hover:bg-board disabled:opacity-50 transition-colors"
            >
              {lookupPending ? "Searching…" : "🔍 Look Up and Confirm"}
            </button>
          </form>
        </div>
      )}

      <div className="bg-surface border border-line rounded-xl p-5">
        <h2 className="font-semibold text-ink mb-3">{editing ? "Update score" : "Manual entry"}</h2>
        {confirmState.error && <p className="text-bad text-sm mb-3">{confirmState.error}</p>}
        <form action={confirmAction}>
          <input type="hidden" name="fixtureId" value={fixtureId} />
          <input type="hidden" name="source" value="MANUAL" />
          <div className="flex items-end gap-3 mb-4">
            <div className="flex-1">
              <label htmlFor="homeScore" className="block text-xs text-ink-muted mb-1 truncate">
                {homeTeam}
              </label>
              <input
                id="homeScore"
                type="number"
                name="homeScore"
                min={0}
                defaultValue={initialHome ?? undefined}
                placeholder="0"
                className="w-full border border-line-strong rounded-lg px-3 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-pitch"
              />
            </div>
            <span className="text-ink-faint font-bold pb-2">–</span>
            <div className="flex-1">
              <label htmlFor="awayScore" className="block text-xs text-ink-muted mb-1 truncate">
                {awayTeam}
              </label>
              <input
                id="awayScore"
                type="number"
                name="awayScore"
                min={0}
                defaultValue={initialAway ?? undefined}
                placeholder="0"
                className="w-full border border-line-strong rounded-lg px-3 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-pitch"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={confirmPending}
            className="w-full bg-pitch text-pitch-on py-2 rounded-lg font-semibold text-sm hover:bg-pitch disabled:opacity-50 transition-colors"
          >
            {confirmPending ? "Saving…" : editing ? "Save changes" : "Save result"}
          </button>
        </form>
      </div>
    </div>
  )
}
