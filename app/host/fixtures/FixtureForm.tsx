"use client"

import { useActionState } from "react"
import type { FixtureFormState } from "./actions"

export type CompetitionOption = { id: string; name: string; flag: string }

type Props = {
  action: (prev: FixtureFormState, formData: FormData) => Promise<FixtureFormState>
  competitions: CompetitionOption[]
  defaultValues?: {
    competitionId: string
    round: string
    homeTeam: string
    awayTeam: string
    kickoffTime: string
  }
  submitLabel: string
}

export default function FixtureForm({ action, competitions, defaultValues, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, {})

  return (
    <form action={formAction} className="space-y-5 max-w-lg">
      {state.error && (
        <p className="text-bad bg-bad-tint border border-bad-line rounded-lg px-4 py-3 text-sm">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink-mid mb-1">Competition</label>
          <select
            name="competitionId"
            defaultValue={defaultValues?.competitionId ?? competitions[0]?.id}
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
        <Field label="Round" name="round" defaultValue={defaultValues?.round} placeholder="Matchweek 1" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Home Team" name="homeTeam" defaultValue={defaultValues?.homeTeam} placeholder="Arsenal" />
        <Field label="Away Team" name="awayTeam" defaultValue={defaultValues?.awayTeam} placeholder="Chelsea" />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink-mid mb-1">Kickoff Time</label>
        <input
          type="datetime-local"
          name="kickoffTime"
          defaultValue={defaultValues?.kickoffTime}
          required
          className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-pitch text-pitch-on px-6 py-2 rounded-lg font-semibold hover:bg-pitch-deep disabled:opacity-50 transition-colors"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  )
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string
  name: string
  defaultValue?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink-mid mb-1">{label}</label>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required
        className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch"
      />
    </div>
  )
}
