"use client"

import { useActionState } from "react"
import type { FixtureFormState } from "./actions"

type Props = {
  action: (prev: FixtureFormState, formData: FormData) => Promise<FixtureFormState>
  defaultValues?: {
    competition: string
    round: string
    homeTeam: string
    awayTeam: string
    kickoffTime: string
  }
  submitLabel: string
}

export default function FixtureForm({ action, defaultValues, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, {})

  return (
    <form action={formAction} className="space-y-5 max-w-lg">
      {state.error && (
        <p className="text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Competition" name="competition" defaultValue={defaultValues?.competition} placeholder="Premier League" />
        <Field label="Round" name="round" defaultValue={defaultValues?.round} placeholder="Round 1" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Home Team" name="homeTeam" defaultValue={defaultValues?.homeTeam} placeholder="Arsenal" />
        <Field label="Away Team" name="awayTeam" defaultValue={defaultValues?.awayTeam} placeholder="Chelsea" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Kickoff Time</label>
        <input
          type="datetime-local"
          name="kickoffTime"
          defaultValue={defaultValues?.kickoffTime}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-[#1a7a3c] text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
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
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
    </div>
  )
}
