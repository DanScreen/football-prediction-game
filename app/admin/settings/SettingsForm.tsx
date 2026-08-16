"use client"

import { useActionState } from "react"
import { updateLeagueSettings, type SettingsFormState } from "./actions"
import { STREAK_TIERS } from "@/lib/scoring"

type Props = {
  defaultValues: {
    name: string
  }
}

export default function SettingsForm({ defaultValues }: Props) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    updateLeagueSettings,
    {},
  )

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

      {/* Read-only: the streak bonus is platform-wide, not a league setting. Shown
          here because commissioners used to control the old Grand Slam and will
          look for it. */}
      <div className="bg-clock-tint border border-clock-line rounded-xl p-4 space-y-2">
        <p className="text-sm font-semibold text-ink">🔥 Streak bonus</p>
        <p className="text-xs text-ink-muted">
          Bonus points for getting a lot of a gameweek&apos;s results right. It applies in
          every league, so there&apos;s nothing to configure here.
        </p>
        <ul className="space-y-1 text-xs text-ink-mid">
          {STREAK_TIERS.map((tier) => (
            <li key={tier.minCorrect}>
              <span className="font-semibold text-clock">
                +{tier.points} point{tier.points !== 1 ? "s" : ""}
              </span>{" "}
              for {tier.minCorrect}+ correct results
            </li>
          ))}
        </ul>
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
