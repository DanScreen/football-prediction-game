"use client"

import { useActionState, useEffect, useState } from "react"
import type { ResultFormState } from "../actions"

interface Props {
  fixtureId: string
  homeTeam: string
  awayTeam: string
  aiEnabled: boolean
  lookupResultAI: (prev: ResultFormState, formData: FormData) => Promise<ResultFormState>
  confirmResult: (prev: ResultFormState, formData: FormData) => Promise<ResultFormState>
}

export default function ConfirmResultForm({
  fixtureId,
  homeTeam,
  awayTeam,
  aiEnabled,
  lookupResultAI,
  confirmResult,
}: Props) {
  const [aiState, aiAction, aiPending] = useActionState(lookupResultAI, {})
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmResult, {})
  const [editHome, setEditHome] = useState("")
  const [editAway, setEditAway] = useState("")
  const [editing, setEditing] = useState(false)

  const proposed = aiState.proposed

  // Pre-fill editable inputs whenever a new AI proposal arrives
  useEffect(() => {
    if (proposed) {
      setEditHome(String(proposed.homeScore))
      setEditAway(String(proposed.awayScore))
      setEditing(false)
    }
  }, [proposed])

  return (
    <div className="space-y-4">
      {/* AI Lookup Panel */}
      {aiEnabled && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h2 className="font-semibold text-blue-900 mb-3">AI Result Lookup</h2>

          {proposed && !editing ? (
            // Show AI proposal with Accept / Edit / Retry
            <div>
              <p className="text-blue-700 text-sm mb-1">AI suggests:</p>
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
                    className="w-full bg-[#1a7a3c] text-white py-2 rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {confirmPending ? "Saving…" : "✓ Accept"}
                  </button>
                </form>
                <button
                  onClick={() => setEditing(true)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-colors"
                >
                  Edit
                </button>
                <form action={aiAction}>
                  <input type="hidden" name="fixtureId" value={fixtureId} />
                  <button
                    type="submit"
                    disabled={aiPending}
                    className="border border-blue-300 text-blue-700 py-2 px-3 rounded-lg font-semibold text-sm hover:bg-blue-100 disabled:opacity-50 transition-colors"
                  >
                    Retry
                  </button>
                </form>
              </div>
            </div>
          ) : editing ? (
            // Editable AI-proposal scores
            <div>
              <p className="text-blue-700 text-sm mb-3">Edit the AI&apos;s suggestion:</p>
              <form action={confirmAction}>
                <input type="hidden" name="fixtureId" value={fixtureId} />
                <input type="hidden" name="source" value="MANUAL" />
                <div className="flex items-end gap-3 mb-4">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1 truncate">{homeTeam}</label>
                    <input
                      type="number"
                      name="homeScore"
                      min={0}
                      value={editHome}
                      onChange={(e) => setEditHome(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <span className="text-gray-400 font-bold pb-2">–</span>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1 truncate">{awayTeam}</label>
                    <input
                      type="number"
                      name="awayScore"
                      min={0}
                      value={editAway}
                      onChange={(e) => setEditAway(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="flex-1 bg-[#1a7a3c] text-white py-2 rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {confirmPending ? "Saving…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="border border-gray-300 text-gray-700 py-2 px-4 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            // Initial AI lookup button
            <div>
              {aiState.error && <p className="text-red-600 text-sm mb-3">{aiState.error}</p>}
              <form action={aiAction}>
                <input type="hidden" name="fixtureId" value={fixtureId} />
                <button
                  type="submit"
                  disabled={aiPending}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {aiPending ? "Searching…" : "🔍 Look Up with AI"}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Manual Entry */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Manual Entry</h2>
        {!aiEnabled && confirmState.error && (
          <p className="text-red-600 text-sm mb-3">{confirmState.error}</p>
        )}
        <form action={confirmAction}>
          <input type="hidden" name="fixtureId" value={fixtureId} />
          <input type="hidden" name="source" value="MANUAL" />
          <div className="flex items-end gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1 truncate">{homeTeam}</label>
              <input
                type="number"
                name="homeScore"
                min={0}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[#1a7a3c]"
              />
            </div>
            <span className="text-gray-400 font-bold pb-2">–</span>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1 truncate">{awayTeam}</label>
              <input
                type="number"
                name="awayScore"
                min={0}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[#1a7a3c]"
              />
            </div>
          </div>
          {aiEnabled && confirmState.error && !proposed && (
            <p className="text-red-600 text-sm mb-3">{confirmState.error}</p>
          )}
          <button
            type="submit"
            disabled={confirmPending}
            className="w-full bg-[#1a7a3c] text-white py-2 rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {confirmPending ? "Saving…" : "Save Result"}
          </button>
        </form>
      </div>
    </div>
  )
}
