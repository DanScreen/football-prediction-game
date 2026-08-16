"use client"

import { useActionState, useEffect, useState } from "react"
import { upsertPrediction, type PredictionState } from "@/app/predictions/actions"

type Props = {
  fixtureId: string
  savedHome?: number
  savedAway?: number
}

export default function PredictionInput({ fixtureId, savedHome, savedAway }: Props) {
  const action = upsertPrediction.bind(null, fixtureId)
  const [state, formAction, pending] = useActionState<PredictionState, FormData>(action, {})

  const hasSaved = savedHome !== undefined && savedAway !== undefined

  // "✓ Saved" used to stick around forever. Clear it after a moment so the control
  // returns to a resting state and doesn't imply an unsaved edit has been saved.
  //
  // Visibility is derived rather than mirrored in state: we only record which result
  // has been dismissed, so the effect's setState happens in the timer callback (a
  // genuine external event) instead of synchronously during the effect.
  const [dismissed, setDismissed] = useState<PredictionState | null>(null)
  const showSaved = Boolean(state.success) && dismissed !== state

  useEffect(() => {
    if (!showSaved) return
    const t = setTimeout(() => setDismissed(state), 2500)
    return () => clearTimeout(t)
  }, [showSaved, state])

  return (
    <form action={formAction} className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <ScoreInput name="home" defaultValue={savedHome} saved={hasSaved} />
        <span className="text-ink-faint font-bold">–</span>
        <ScoreInput name="away" defaultValue={savedAway} saved={hasSaved} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-pitch text-pitch-on shadow-card hover:bg-pitch-deep disabled:opacity-50 transition-colors"
      >
        {pending ? "…" : hasSaved ? "Update" : "Save"}
      </button>

      {/* Fixed-width, always-present status slot: feedback used to be inserted
          into the flex row, shoving the inputs sideways as it appeared. */}
      <span className="w-14 shrink-0 text-xs leading-tight" role="status" aria-live="polite">
        {state.error ? (
          <span className="text-bad">{state.error}</span>
        ) : showSaved ? (
          <span className="font-medium text-pitch animate-pop">✓ Saved</span>
        ) : null}
      </span>
    </form>
  )
}

function ScoreInput({
  name,
  defaultValue,
  saved,
}: {
  name: string
  defaultValue?: number
  saved: boolean
}) {
  return (
    <input
      type="number"
      name={name}
      min={0}
      max={99}
      defaultValue={defaultValue}
      placeholder="·"
      required
      aria-label={name === "home" ? "Home score" : "Away score"}
      className={`score-digits h-11 w-11 rounded-lg border-[1.5px] text-center text-xl transition-colors focus:outline-none focus:ring-2 focus:ring-pitch focus:border-pitch [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
        saved
          ? "border-pitch/50 bg-pitch-tint text-pitch-deep"
          : "border-line-strong bg-surface text-ink"
      }`}
    />
  )
}
