"use client"

import { useActionState } from "react"
import { toggleBanker, type BankerState } from "@/app/predictions/actions"

type Props = {
  fixtureId: string
  isBanker: boolean
  /** Banker needs a prediction to attach to; without one the button explains why. */
  hasPrediction: boolean
}

/**
 * Toggles this fixture as the user's banker (double points) for its gameweek.
 *
 * Selecting a new banker clears the old one server-side, so this is a plain
 * toggle per fixture rather than a radio group — the group would have to span
 * a whole round's cards, which are rendered independently.
 */
export default function BankerButton({ fixtureId, isBanker, hasPrediction }: Props) {
  const action = toggleBanker.bind(null, fixtureId, !isBanker)
  const [state, formAction, pending] = useActionState<BankerState, FormData>(action, {})

  if (!hasPrediction) {
    return (
      <span className="text-xs text-ink-faint" title="Enter both scores to use your banker here">
        ×2 once both scores are in
      </span>
    )
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        aria-pressed={isBanker}
        title={
          isBanker
            ? "Your banker for this gameweek — points doubled. Click to clear."
            : "Make this your banker for the gameweek — double points"
        }
        className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
          isBanker
            ? "border-clock bg-clock text-clock-on shadow-card"
            : "border-line-strong bg-surface text-ink-muted hover:border-clock hover:text-clock"
        }`}
      >
        <span aria-hidden="true">{isBanker ? "★" : "☆"}</span>
        {pending ? "…" : isBanker ? "Banker ×2" : "Banker"}
      </button>

      {state.error && (
        <span className="text-xs leading-tight text-bad" role="status">
          {state.error}
        </span>
      )}
    </form>
  )
}
