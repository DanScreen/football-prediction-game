"use client"

import { useActionState } from "react"
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
        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-pitch text-white shadow-card hover:bg-pitch-deep disabled:opacity-50 transition-colors"
      >
        {pending ? "…" : hasSaved ? "Update" : "Save"}
      </button>

      {state.success && (
        <span className="text-xs text-pitch-deep font-medium animate-pop">✓ Saved</span>
      )}
      {state.error && (
        <span className="text-xs text-red-500">{state.error}</span>
      )}
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
