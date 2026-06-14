"use client"

import { useEffect, useRef, useState } from "react"

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export function AnimatedPoints({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const DURATION = 900
    const startTime = performance.now()

    function tick(now: number) {
      const t = Math.min((now - startTime) / DURATION, 1)
      const ease = 1 - (1 - t) ** 3 // cubic ease-out
      const raw = ease * value
      // snap to nearest 0.5 to stay on valid point values
      setDisplayed(t < 1 ? Math.round(raw * 2) / 2 : value)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value])

  return <>{fmt(displayed)}</>
}
