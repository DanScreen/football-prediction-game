"use client"

import { useActionState, useState } from "react"
import { updateLeagueSettings, type SettingsFormState } from "./actions"

type Props = {
  defaultValues: {
    name: string
    grandSlamEnabled: boolean
    grandSlamPoints: number
  }
}

export default function SettingsForm({ defaultValues }: Props) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    updateLeagueSettings,
    {},
  )
  const [slamEnabled, setSlamEnabled] = useState(defaultValues.grandSlamEnabled)

  return (
    <form action={formAction} className="space-y-5 max-w-lg">
      {state.error && (
        <p className="text-bad bg-bad-tint border border-bad-line rounded-lg px-4 py-3 text-sm">
          {state.error}
        </p>
      )}
      {state.success && !state.error && (
        <p className="text-good bg-good-tint border border-good-line rounded-lg px-4 py-3 text-sm">
          ✓ Settings saved.
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-ink-mid mb-1">League Name</label>
        <input
          type="text"
          name="name"
          defaultValue={defaultValues.name}
          required
          maxLength={50}
          className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch"
        />
      </div>

      <div className="bg-clock-tint border border-clock-line rounded-xl p-4 space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="grandSlamEnabled"
            checked={slamEnabled}
            onChange={(e) => setSlamEnabled(e.target.checked)}
            className="w-4 h-4 accent-pitch"
          />
          <span className="text-sm font-semibold text-ink">🏆 Grand Slam bonus</span>
        </label>
        <p className="text-xs text-ink-muted">
          Awards bonus points to anyone who predicts the correct result (win/draw/loss) for
          every fixture in a round.
        </p>
        <div>
          <label className="block text-sm font-medium text-ink-mid mb-1">Bonus points</label>
          <input
            type="number"
            name="grandSlamPoints"
            min={1}
            max={20}
            defaultValue={defaultValues.grandSlamPoints}
            required
            disabled={!slamEnabled}
            className="w-24 border border-line-strong rounded-lg px-3 py-2 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-pitch disabled:opacity-50 disabled:bg-chip"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="bg-pitch text-pitch-on px-6 py-2 rounded-lg font-semibold hover:bg-pitch disabled:opacity-50 transition-colors"
      >
        {pending ? "Saving…" : "Save Settings"}
      </button>
    </form>
  )
}
