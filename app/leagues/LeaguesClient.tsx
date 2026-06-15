"use client"

import { useActionState, useState } from "react"
import {
  createLeague,
  joinLeague,
  confirmLeagueFixtures,
  type LeagueActionState,
  type ConfirmFixturesState,
} from "./actions"
import { COMPETITIONS } from "./data"

export default function LeaguesClient({ hasLeagues }: { hasLeagues: boolean }) {
  const [tab, setTab] = useState<"create" | "join">(hasLeagues ? "join" : "create")

  const [createState, createAction, createPending] = useActionState<LeagueActionState, FormData>(
    createLeague,
    {},
  )
  const [confirmState, confirmAction, confirmPending] = useActionState<
    ConfirmFixturesState,
    FormData
  >(confirmLeagueFixtures, {})
  const [joinState, joinAction, joinPending] = useActionState<LeagueActionState, FormData>(
    joinLeague,
    {},
  )

  const [selectedComp, setSelectedComp] = useState<string>("")
  const [deselected, setDeselected] = useState<Set<number>>(new Set())

  const pending = createState.pendingLeague

  // Fixture confirmation step — shown after league is created
  if (pending) {
    const selectedFixtures = pending.proposed.filter((_, i) => !deselected.has(i))

    const toggle = (i: number) => {
      const next = new Set(deselected)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      setDeselected(next)
    }

    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-green-50">
          <p className="text-sm font-semibold text-green-800">
            ✓ League &quot;{pending.name}&quot; created — invite code:{" "}
            <span className="font-mono">{pending.inviteCode}</span>
          </p>
        </div>

        <div className="p-6">
          {pending.aiError ? (
            <div className="text-center py-6">
              <p className="text-amber-600 text-sm mb-4">{pending.aiError}</p>
              <form action={confirmAction}>
                <input type="hidden" name="leagueId" value={pending.id} />
                <input type="hidden" name="fixtures" value="[]" />
                <button
                  type="submit"
                  disabled={confirmPending}
                  className="bg-[#1a7a3c] text-white px-6 py-2 rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {confirmPending ? "Going to Dashboard…" : "Go to Dashboard →"}
                </button>
              </form>
            </div>
          ) : pending.proposed.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-500 text-sm mb-4">
                AI found no upcoming fixtures for {pending.competition}. You can add them manually
                via the Admin panel.
              </p>
              <form action={confirmAction}>
                <input type="hidden" name="leagueId" value={pending.id} />
                <input type="hidden" name="fixtures" value="[]" />
                <button
                  type="submit"
                  disabled={confirmPending}
                  className="bg-[#1a7a3c] text-white px-6 py-2 rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {confirmPending ? "Going to Dashboard…" : "Go to Dashboard →"}
                </button>
              </form>
            </div>
          ) : (
            <>
              <h2 className="font-semibold text-gray-900 mb-1">Upcoming Fixtures Found</h2>
              <p className="text-gray-500 text-sm mb-4">
                {pending.competition} · {pending.proposed.length} fixture
                {pending.proposed.length !== 1 ? "s" : ""} found — deselect any to skip
              </p>

              <div className="space-y-2 mb-5 max-h-72 overflow-y-auto">
                {pending.proposed.map((f, i) => (
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
                        {f.round && <span className="mr-2">{f.round}</span>}
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
                <input type="hidden" name="leagueId" value={pending.id} />
                <input type="hidden" name="fixtures" value={JSON.stringify(selectedFixtures)} />
                <button
                  type="submit"
                  disabled={confirmPending}
                  className="w-full bg-[#1a7a3c] text-white py-2 rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {confirmPending
                    ? "Importing…"
                    : selectedFixtures.length === 0
                      ? "Skip — Go to Dashboard →"
                      : `Import ${selectedFixtures.length} fixture${selectedFixtures.length !== 1 ? "s" : ""} →`}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex border-b border-gray-200">
        {(["create", "join"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === t
                ? "bg-white text-gray-900 border-b-2 border-[#1a7a3c]"
                : "bg-gray-50 text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "create" ? "⚽ Create a League" : "🔗 Join a League"}
          </button>
        ))}
      </div>

      <div className="p-6">
        {tab === "create" ? (
          <form action={createAction} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">League Name</label>
              <input
                name="name"
                required
                maxLength={50}
                placeholder="e.g. Office Predictions 2026"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a7a3c]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Competition</label>
              <div className="grid grid-cols-2 gap-3">
                {COMPETITIONS.map((c) => (
                  <label
                    key={c.value}
                    className={`flex flex-col items-center gap-1.5 p-4 border-2 rounded-xl cursor-pointer transition-colors ${
                      selectedComp === c.value
                        ? "border-[#1a7a3c] bg-green-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="competition"
                      value={c.value}
                      required
                      className="sr-only"
                      onChange={() => setSelectedComp(c.value)}
                    />
                    <span className="text-3xl">{c.flag}</span>
                    <span className="text-sm font-semibold text-gray-900 text-center">
                      {c.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-500">
              An invite code will be generated automatically. Upcoming fixtures will be imported
              automatically via AI.
            </p>

            {createState.error && <p className="text-red-600 text-sm">{createState.error}</p>}

            <button
              type="submit"
              disabled={createPending || !selectedComp}
              className="w-full bg-[#1a7a3c] text-white py-2 rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {createPending ? "Creating league & finding fixtures…" : "Create League"}
            </button>
          </form>
        ) : (
          <form action={joinAction} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invite Code</label>
              <input
                name="code"
                required
                maxLength={10}
                placeholder="e.g. ABC123"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-[#1a7a3c]"
              />
            </div>
            <p className="text-xs text-gray-500">
              Ask your league commissioner for the invite code.
            </p>
            {joinState.error && <p className="text-red-600 text-sm">{joinState.error}</p>}
            <button
              type="submit"
              disabled={joinPending}
              className="w-full bg-[#1a7a3c] text-white py-2 rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {joinPending ? "Joining…" : "Join League"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
