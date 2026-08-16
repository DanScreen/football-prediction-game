"use client"

import { useTransition } from "react"
import { regenerateApiKey } from "./actions"

export default function RegenerateKeyButton() {
  const [isPending, startTransition] = useTransition()

  // Regenerating invalidates any bot using the old key, so this reads as a
  // cautionary action (amber outline) rather than a primary green button.
  return (
    <button
      onClick={() => startTransition(() => regenerateApiKey())}
      disabled={isPending}
      className="rounded-md border border-clock-line bg-clock-tint px-4 py-2 text-sm font-semibold text-clock shadow-card transition-colors hover:border-clock/50 focus:outline-none focus:ring-2 focus:ring-clock focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-60"
    >
      {isPending ? "Regenerating…" : "Regenerate Key"}
    </button>
  )
}
