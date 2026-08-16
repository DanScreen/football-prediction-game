"use client"

import { useActionState, useState } from "react"
import { createLeague, joinLeague, type LeagueActionState } from "./actions"

export type CompetitionOption = { id: string; name: string; flag: string }

export default function LeaguesClient({
  hasLeagues,
  competitions,
}: {
  hasLeagues: boolean
  competitions: CompetitionOption[]
}) {
  const [tab, setTab] = useState<"create" | "join">(hasLeagues ? "join" : "create")

  const [createState, createAction, createPending] = useActionState<LeagueActionState, FormData>(
    createLeague,
    {},
  )
  const [joinState, joinAction, joinPending] = useActionState<LeagueActionState, FormData>(
    joinLeague,
    {},
  )

  const [selectedComp, setSelectedComp] = useState<string>("")

  return (
    <div className="bg-surface rounded-xl border border-line shadow-card overflow-hidden">
      <div className="flex border-b border-line">
        {(["create", "join"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === t
                ? "bg-surface text-ink border-b-2 border-pitch"
                : "bg-ground text-ink-muted hover:text-ink-mid"
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
              <label className="block text-sm font-medium text-ink-mid mb-1">League Name</label>
              <input
                name="name"
                required
                maxLength={50}
                placeholder="e.g. Office Predictions 2026"
                className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-mid mb-2">Competition</label>
              <div className="grid grid-cols-2 gap-3">
                {competitions.map((c) => (
                  <label
                    key={c.id}
                    className={`flex flex-col items-center gap-1.5 p-4 border-2 rounded-xl cursor-pointer transition-colors ${
                      selectedComp === c.id
                        ? "border-pitch bg-good-tint"
                        : "border-line hover:border-line-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name="competitionId"
                      value={c.id}
                      required
                      className="sr-only"
                      onChange={() => setSelectedComp(c.id)}
                    />
                    <span className="text-3xl">{c.flag}</span>
                    <span className="text-sm font-semibold text-ink text-center">
                      {c.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <p className="text-xs text-ink-muted">
              An invite code will be generated automatically. Fixtures and results are added for you
              — just pick your competition and start predicting.
            </p>

            {createState.error && <p className="text-bad text-sm">{createState.error}</p>}

            <button
              type="submit"
              disabled={createPending || !selectedComp}
              className="w-full bg-pitch text-pitch-on py-2 rounded-lg font-semibold text-sm hover:bg-pitch disabled:opacity-50 transition-colors"
            >
              {createPending ? "Creating league…" : "Create League"}
            </button>
          </form>
        ) : (
          <form action={joinAction} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-mid mb-1">Invite Code</label>
              <input
                name="code"
                required
                maxLength={10}
                placeholder="e.g. ABC123"
                className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-pitch"
              />
            </div>
            <p className="text-xs text-ink-muted">
              Ask your league commissioner for the invite code.
            </p>
            {joinState.error && <p className="text-bad text-sm">{joinState.error}</p>}
            <button
              type="submit"
              disabled={joinPending}
              className="w-full bg-pitch text-pitch-on py-2 rounded-lg font-semibold text-sm hover:bg-pitch disabled:opacity-50 transition-colors"
            >
              {joinPending ? "Joining…" : "Join League"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
