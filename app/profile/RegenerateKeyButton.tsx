"use client"

import { useTransition } from "react"
import { regenerateApiKey } from "./actions"

export default function RegenerateKeyButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => regenerateApiKey())}
      disabled={isPending}
      className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-60 transition-colors"
    >
      {isPending ? "Regenerating…" : "Regenerate Key"}
    </button>
  )
}
