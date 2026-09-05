"use client"

import { useActionState } from "react"
import type { CompetitionFormState } from "./actions"

type Props = {
  action: (prev: CompetitionFormState, formData: FormData) => Promise<CompetitionFormState>
  defaultValues?: {
    name: string
    code: string
    flag: string
    isActive: boolean
    archived: boolean
  }
  submitLabel: string
}

export default function CompetitionForm({ action, defaultValues, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, {})

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="text-bad bg-bad-tint border border-bad-line rounded-lg px-4 py-3 text-sm">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink-mid mb-1">Name</label>
          <input
            type="text"
            name="name"
            defaultValue={defaultValues?.name}
            placeholder="Premier League"
            required
            className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-mid mb-1">
            API code <span className="font-normal text-ink-faint">(football-data.org, optional)</span>
          </label>
          <input
            type="text"
            name="code"
            defaultValue={defaultValues?.code}
            placeholder="PL"
            className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-pitch"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-ink-mid mb-1">
            Flag emoji <span className="font-normal text-ink-faint">(optional)</span>
          </label>
          <input
            type="text"
            name="flag"
            defaultValue={defaultValues?.flag}
            placeholder="🏴󠁧󠁢󠁥󠁮󠁧󠁿"
            className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch"
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-ink-mid pb-2">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={defaultValues?.isActive ?? true}
            className="h-4 w-4 rounded border-line-strong accent-[#128749]"
          />
          Active (auto-import + selectable for new leagues)
        </label>
      </div>

      <div className="rounded-lg border border-line bg-chip/40 px-4 py-3">
        <label className="flex items-start gap-2 text-sm font-medium text-ink-mid">
          <input
            type="checkbox"
            name="archived"
            defaultChecked={defaultValues?.archived ?? false}
            className="mt-0.5 h-4 w-4 rounded border-line-strong accent-[#128749]"
          />
          <span>
            Finished
            <span className="mt-0.5 block text-xs font-normal text-ink-muted">
              Declares the competition over. It leaves Predict, Results and the leaderboard,
              and stops auto-importing fixtures and sending deadline reminders. Nothing is
              deleted — its leagues move to &ldquo;Finished leagues&rdquo; and the final
              standings stay readable. Untick to bring it back.
            </span>
          </span>
        </label>
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
