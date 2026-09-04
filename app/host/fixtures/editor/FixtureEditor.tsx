"use client"

import { useActionState, useMemo, useState } from "react"
import { deleteFixtures, reassignRound, type EditorState } from "./actions"

export type EditorFixture = {
  id: string
  round: string
  homeTeam: string
  awayTeam: string
  kickoffIso: string
  status: string
  predictionCount: number
}

/**
 * Bulk gameweek editor. Selection lives here rather than in the URL — a host
 * re-cutting a round ticks a dozen boxes across several groups, and losing that
 * to a navigation is the whole cost of the tool.
 *
 * Both actions post the selected ids as repeated `fixtureId` fields, so the
 * server action reads them with `formData.getAll` and never trusts a count sent
 * from the client.
 */
export default function FixtureEditor({ fixtures }: { fixtures: EditorFixture[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [round, setRound] = useState("")
  const [moveState, moveAction, movePending] = useActionState<EditorState, FormData>(
    reassignRound,
    {},
  )
  const [deleteState, deleteAction, deletePending] = useActionState<EditorState, FormData>(
    deleteFixtures,
    {},
  )

  const groups = useMemo(() => {
    const byRound = new Map<string, EditorFixture[]>()
    for (const f of fixtures) {
      const found = byRound.get(f.round)
      if (found) found.push(f)
      else byRound.set(f.round, [f])
    }
    return [...byRound.entries()].map(([name, items]) => ({ name, fixtures: items }))
  }, [fixtures])

  const existingRounds = useMemo(() => groups.map((g) => g.name), [groups])

  // A stale selection (something deleted, or moved by another host) would post
  // ids that no longer resolve, so only ever submit ids still on the page.
  const live = useMemo(() => new Set(fixtures.map((f) => f.id)), [fixtures])
  const selectedIds = useMemo(() => [...selected].filter((id) => live.has(id)), [selected, live])

  const pending = movePending || deletePending
  const result = movePending || deletePending ? null : (pickResult(moveState) ?? pickResult(deleteState))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleGroup(group: { fixtures: EditorFixture[] }, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const f of group.fixtures) {
        if (on) next.add(f.id)
        else next.delete(f.id)
      }
      return next
    })
  }

  return (
    <div>
      <div className="sticky top-0 z-10 mb-6 rounded-xl border border-line bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-end gap-3">
          <p className="mr-auto text-sm font-semibold text-ink">
            {selectedIds.length === 0
              ? "Select fixtures to move or remove"
              : `${selectedIds.length} selected`}
          </p>

          <form action={moveAction} className="flex flex-wrap items-end gap-2">
            {selectedIds.map((id) => (
              <input key={id} type="hidden" name="fixtureId" value={id} />
            ))}
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-ink-muted">Move to gameweek</span>
              <input
                name="round"
                value={round}
                onChange={(e) => setRound(e.target.value)}
                list="existing-rounds"
                placeholder="Matchweek 8"
                className="h-10 w-52 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus:border-pitch focus:outline-none focus:ring-2 focus:ring-pitch"
              />
            </label>
            <datalist id="existing-rounds">
              {existingRounds.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
            <button
              type="submit"
              disabled={pending || selectedIds.length === 0 || round.trim() === ""}
              className="h-10 rounded-lg bg-pitch px-4 text-sm font-semibold text-pitch-on transition-colors hover:bg-pitch-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              {movePending ? "Moving…" : "Move"}
            </button>
          </form>

          <form
            action={deleteAction}
            onSubmit={(e) => {
              if (!confirm(`Delete ${selectedIds.length} fixture(s)? This cannot be undone.`)) {
                e.preventDefault()
              }
            }}
          >
            {selectedIds.map((id) => (
              <input key={id} type="hidden" name="fixtureId" value={id} />
            ))}
            <button
              type="submit"
              disabled={pending || selectedIds.length === 0}
              className="h-10 rounded-lg border border-bad px-4 text-sm font-semibold text-bad transition-colors hover:bg-bad-tint disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deletePending ? "Deleting…" : "Delete"}
            </button>
          </form>
        </div>

        {result && (
          <p
            role="status"
            className={`mt-3 text-sm ${result.ok ? "font-medium text-pitch" : "text-bad"}`}
          >
            {result.ok ? result.message : result.error}
          </p>
        )}
      </div>

      <div className="space-y-6">
        {groups.map((group) => {
          const all = group.fixtures.every((f) => selected.has(f.id))
          return (
            <section key={group.name} className="rounded-xl border border-line shadow-card">
              <header className="flex items-center gap-3 border-b border-line-soft bg-ground px-4 py-3">
                <input
                  type="checkbox"
                  checked={all}
                  onChange={(e) => toggleGroup(group, e.target.checked)}
                  aria-label={`Select all in ${group.name}`}
                  className="h-4 w-4 accent-pitch"
                />
                <h2 className="font-bold text-ink">{group.name}</h2>
                <span className="text-xs text-ink-muted">
                  {group.fixtures.length} fixture{group.fixtures.length === 1 ? "" : "s"}
                </span>
              </header>
              <ul className="divide-y divide-line-soft">
                {group.fixtures.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-ground">
                    <input
                      type="checkbox"
                      checked={selected.has(f.id)}
                      onChange={() => toggle(f.id)}
                      aria-label={`Select ${f.homeTeam} v ${f.awayTeam}`}
                      className="h-4 w-4 accent-pitch"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                      {f.homeTeam} <span className="text-ink-faint">v</span> {f.awayTeam}
                    </span>
                    <span className="hidden shrink-0 text-xs text-ink-muted sm:block">
                      {new Date(f.kickoffIso).toLocaleString("en-GB", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {f.predictionCount > 0 && (
                      <span className="shrink-0 rounded-full bg-chip px-2 py-0.5 text-xs font-medium text-ink-muted">
                        {f.predictionCount} pick{f.predictionCount === 1 ? "" : "s"}
                      </span>
                    )}
                    {f.status !== "SCHEDULED" && (
                      <span className="shrink-0 text-xs font-medium text-ink-muted">
                        {f.status === "COMPLETED" ? "✅ settled" : "🟨 awaiting"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function pickResult(state: EditorState) {
  return "ok" in state ? state : null
}
