"use client"

import { useActionState, useState } from "react"
import { createLeague, joinLeague, type LeagueActionState } from "./actions"

export default function LeaguesClient({ hasLeagues }: { hasLeagues: boolean }) {
  const [tab, setTab] = useState<"create" | "join">(hasLeagues ? "join" : "create")
  const [createState, createAction, createPending] = useActionState<LeagueActionState, FormData>(
    createLeague,
    {},
  )
  const [joinState, joinAction, joinPending] = useActionState<LeagueActionState, FormData>(
    joinLeague,
    {},
  )

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
          <form action={createAction} className="space-y-4">
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
            <p className="text-xs text-gray-500">
              An invite code will be generated automatically — share it with friends so they can
              join.
            </p>
            {createState.error && (
              <p className="text-red-600 text-sm">{createState.error}</p>
            )}
            <button
              type="submit"
              disabled={createPending}
              className="w-full bg-[#1a7a3c] text-white py-2 rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {createPending ? "Creating…" : "Create League"}
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
            {joinState.error && (
              <p className="text-red-600 text-sm">{joinState.error}</p>
            )}
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
