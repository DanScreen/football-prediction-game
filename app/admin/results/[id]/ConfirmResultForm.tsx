"use client"

import { useActionState, useState } from "react"
import type { ResultFormState } from "../actions"

interface Props {
  fixtureId: string
  homeTeam: string
  awayTeam: string
  apiEnabled: boolean
  /** Score pre-fetched by the automated sweep, shown before any manual lookup */
  initialProposed?: { homeScore: number; awayScore: number }
  lookupResult: (prev: ResultFormState, formData: FormData) => Promise<ResultFormState>
  confirmResult: (prev: ResultFormState, formData: FormData) => Promise<ResultFormState>
}

type EditState = {
  home: string
  away: string
  forProposed: ResultFormState["proposed"]
}

export default function ConfirmResultForm({
  fixtureId,
  homeTeam,
  awayTeam,
  apiEnabled,
  initialProposed,
  lookupResult,
  confirmResult,
}: Props) {
  const [lookupState, lookupAction, lookupPending] = useActionState(lookupResult, {})
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmResult, {})
  const [editState, setEditState] = useState<EditState | null>(null)

  const proposed = lookupState.proposed ?? initialProposed
  const isEditing = editState !== null && editState.forProposed === proposed

  return (
    <div className="space-y-4">
      {/* API Lookup Panel */}
      {apiEnabled && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h2 className="font-semibold text-blue-900 mb-3">Result Lookup</h2>

          {proposed && !isEditing ? (
            // Show proposed result with Accept / Edit / Retry
            <div>
              <p className="text-blue-700 text-sm mb-1">Result found:</p>
              <p className="text-3xl font-bold text-blue-900 text-center tracking-wide mb-1">
                {proposed.homeScore} – {proposed.awayScore}
              </p>
              <p className="text-center text-blue-600 text-xs mb-4">
                {homeTeam} vs {awayTeam}
              </p>
              {confirmState.error && (
                <p className="text-red-600 text-sm mb-3">{confirmState.error}</p>
              )}
              <div className="flex gap-2">
                <form action={confirmAction} className="flex-1">
                  <input type="hidden" name="fixtureId" value={fixtureId} />
                  <input type="hidden" name="homeScore" value={proposed.homeScore} />
                  <input type="hidden" name="awayScore" value={proposed.awayScore} />
                  <input type="hidden" name="source" value="AI_CONFIRMED" />
                  <button
                    type="submit"
                    disabled={confirmPending}
                    className="w-full bg-pitch text-white py-2 rounded-lg font-semibold text-sm hover:bg-pitch disabled:opacity-50 transition-colors"
                  >
                    {confirmPending ? "Saving…" : "✓ Accept"}
                  </button>
                </form>
                <button
                  onClick={() =>
                    setEditState({
                      home: String(proposed.homeScore),
                      away: String(proposed.awayScore),
                      forProposed: proposed,
                    })
                  }
                  className="flex-1 border border-line-strong text-ink-mid py-2 rounded-lg font-semibold text-sm hover:bg-ground transition-colors"
                >
                  Edit
                </button>
                <form action={lookupAction}>
                  <input type="hidden" name="fixtureId" value={fixtureId} />
                  <button
                    type="submit"
                    disabled={lookupPending}
                    className="border border-blue-300 text-blue-700 py-2 px-3 rounded-lg font-semibold text-sm hover:bg-blue-100 disabled:opacity-50 transition-colors"
                  >
                    Retry
                  </button>
                </form>
              </div>
            </div>
          ) : isEditing ? (
            // Editable scores
            <div>
              <p className="text-blue-700 text-sm mb-3">Edit the result:</p>
              <form action={confirmAction}>
                <input type="hidden" name="fixtureId" value={fixtureId} />
                <input type="hidden" name="source" value="MANUAL" />
                <div className="flex items-end gap-3 mb-4">
                  <div className="flex-1">
                    <label className="block text-xs text-ink-muted mb-1 truncate">{homeTeam}</label>
                    <input
                      type="number"
                      name="homeScore"
                      min={0}
                      value={editState!.home}
                      onChange={(e) => setEditState((s) => s && { ...s, home: e.target.value })}
                      className="w-full border border-line-strong rounded-lg px-3 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <span className="text-ink-faint font-bold pb-2">–</span>
                  <div className="flex-1">
                    <label className="block text-xs text-ink-muted mb-1 truncate">{awayTeam}</label>
                    <input
                      type="number"
                      name="awayScore"
                      min={0}
                      value={editState!.away}
                      onChange={(e) => setEditState((s) => s && { ...s, away: e.target.value })}
                      className="w-full border border-line-strong rounded-lg px-3 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                {confirmState.error && (
                  <p className="text-red-600 text-sm mb-3">{confirmState.error}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={confirmPending}
                    className="flex-1 bg-pitch text-white py-2 rounded-lg font-semibold text-sm hover:bg-pitch disabled:opacity-50 transition-colors"
                  >
                    {confirmPending ? "Saving…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditState(null)}
                    className="border border-line-strong text-ink-mid py-2 px-4 rounded-lg text-sm hover:bg-ground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            // Initial lookup button
            <div>
              {lookupState.error && (
                <p className="text-red-600 text-sm mb-3">{lookupState.error}</p>
              )}
              <form action={lookupAction}>
                <input type="hidden" name="fixtureId" value={fixtureId} />
                <button
                  type="submit"
                  disabled={lookupPending}
                  className="w-full bg-board-panel text-board-fore py-2 rounded-lg font-semibold text-sm hover:bg-board disabled:opacity-50 transition-colors"
                >
                  {lookupPending ? "Searching…" : "🔍 Look Up Result"}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Manual Entry */}
      <div className="bg-surface border border-line rounded-xl p-5">
        <h2 className="font-semibold text-ink mb-3">Manual Entry</h2>
        {!apiEnabled && confirmState.error && (
          <p className="text-red-600 text-sm mb-3">{confirmState.error}</p>
        )}
        <form action={confirmAction}>
          <input type="hidden" name="fixtureId" value={fixtureId} />
          <input type="hidden" name="source" value="MANUAL" />
          <div className="flex items-end gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs text-ink-muted mb-1 truncate">{homeTeam}</label>
              <input
                type="number"
                name="homeScore"
                min={0}
                placeholder="0"
                className="w-full border border-line-strong rounded-lg px-3 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-pitch"
              />
            </div>
            <span className="text-ink-faint font-bold pb-2">–</span>
            <div className="flex-1">
              <label className="block text-xs text-ink-muted mb-1 truncate">{awayTeam}</label>
              <input
                type="number"
                name="awayScore"
                min={0}
                placeholder="0"
                className="w-full border border-line-strong rounded-lg px-3 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-pitch"
              />
            </div>
          </div>
          {apiEnabled && confirmState.error && !proposed && (
            <p className="text-red-600 text-sm mb-3">{confirmState.error}</p>
          )}
          <button
            type="submit"
            disabled={confirmPending}
            className="w-full bg-pitch text-white py-2 rounded-lg font-semibold text-sm hover:bg-pitch disabled:opacity-50 transition-colors"
          >
            {confirmPending ? "Saving…" : "Save Result"}
          </button>
        </form>
      </div>
    </div>
  )
}
