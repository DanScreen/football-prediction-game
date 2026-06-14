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
    <form action={formAction} className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <ScoreInput name="home" defaultValue={savedHome} />
        <span className="text-gray-400 font-bold text-sm">–</span>
        <ScoreInput name="away" defaultValue={savedAway} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#1a7a3c] text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {pending ? "…" : hasSaved ? "Update" : "Save"}
      </button>

      {state.success && (
        <span className="text-xs text-green-600 font-medium">✓ Saved</span>
      )}
      {state.error && (
        <span className="text-xs text-red-500">{state.error}</span>
      )}
    </form>
  )
}

function ScoreInput({ name, defaultValue }: { name: string; defaultValue?: number }) {
  return (
    <input
      type="number"
      name={name}
      min={0}
      max={99}
      defaultValue={defaultValue}
      placeholder="–"
      required
      className="w-10 text-center border border-gray-300 rounded-md py-1 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-green-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  )
}
