"use client"

import { useActionState } from "react"
import { requestResult, type RequestResultState } from "@/app/actions"

export default function RequestResultButton({ fixtureId }: { fixtureId: string }) {
  const action = requestResult.bind(null, fixtureId)
  const [state, formAction, pending] = useActionState<RequestResultState, FormData>(action, {})

  if (state.pending) {
    return (
      <span className="text-xs text-ink-muted italic">
        No result published yet — try again in a bit.
      </span>
    )
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-line-strong text-ink-muted hover:border-pitch hover:text-pitch disabled:opacity-50 transition-colors"
      >
        {pending ? "Checking…" : "🔍 Request result"}
      </button>
      {state.error && <span className="text-xs text-red-500">{state.error}</span>}
    </form>
  )
}
