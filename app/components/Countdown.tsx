"use client"

import { useEffect, useState } from "react"

export default function Countdown({ kickoffTime }: { kickoffTime: string }) {
  const [label, setLabel] = useState("")

  useEffect(() => {
    function update() {
      const diff = new Date(kickoffTime).getTime() - Date.now()
      if (diff <= 0) {
        setLabel("Locked")
        return
      }
      const days = Math.floor(diff / 86_400_000)
      const hours = Math.floor((diff % 86_400_000) / 3_600_000)
      const mins = Math.floor((diff % 3_600_000) / 60_000)
      const parts: string[] = []
      if (days > 0) parts.push(`${days}d`)
      if (hours > 0 || days > 0) parts.push(`${hours}h`)
      parts.push(`${mins}m`)
      setLabel(parts.join(" "))
    }
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [kickoffTime])

  const locked = label === "Locked"
  return (
    <span
      className={`score-digits inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm ${
        locked ? "bg-red-50 text-red-600" : "bg-clock-tint text-clock"
      }`}
    >
      {locked ? "🔒 Locked" : label}
    </span>
  )
}
