"use client"

import { useEffect, useState } from "react"

const SOON_MS = 86_400_000

type CountdownState = { label: string; locked: boolean; soon: boolean }

export default function Countdown({ kickoffTime }: { kickoffTime: string }) {
  const [state, setState] = useState<CountdownState>({ label: "", locked: false, soon: false })

  useEffect(() => {
    function update() {
      const diff = new Date(kickoffTime).getTime() - Date.now()
      if (diff <= 0) {
        setState({ label: "Locked", locked: true, soon: true })
        return
      }
      const days = Math.floor(diff / 86_400_000)
      const hours = Math.floor((diff % 86_400_000) / 3_600_000)
      const mins = Math.floor((diff % 3_600_000) / 60_000)
      const parts: string[] = []
      if (days > 0) parts.push(`${days}d`)
      if (hours > 0 || days > 0) parts.push(`${hours}h`)
      parts.push(`${mins}m`)
      setState({ label: parts.join(" "), locked: false, soon: diff <= SOON_MS })
    }
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [kickoffTime])

  const toneClass = state.locked
    ? "bg-bad-tint text-bad"
    : state.soon
      ? "bg-clock-tint text-clock"
      : "bg-chip text-ink-muted"
  return (
    <span
      className={`score-digits inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm ${toneClass}`}
    >
      {state.locked ? "🔒 Locked" : state.label}
    </span>
  )
}
