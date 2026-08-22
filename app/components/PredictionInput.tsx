"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { savePredictionScores } from "@/app/predictions/actions"

const DEBOUNCE_MS = 450

type Props = {
  fixtureId: string
  savedHome?: number
  savedAway?: number
  /** Fires after a successful save so Banker can enable without waiting for RSC refresh. */
  onSaved?: () => void
}

function parseScore(raw: string): number | null {
  if (raw === "") return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0 || n > 99) return null
  return n
}

/**
 * Score inputs that auto-save once both sides are valid integers.
 * Debounces typing (~450ms) and also saves on blur when both are filled.
 */
export default function PredictionInput({ fixtureId, savedHome, savedAway, onSaved }: Props) {
  const [home, setHome] = useState(savedHome !== undefined ? String(savedHome) : "")
  const [away, setAway] = useState(savedAway !== undefined ? String(savedAway) : "")
  const [lastSaved, setLastSaved] = useState<{ home: number; away: number } | null>(
    savedHome !== undefined && savedAway !== undefined
      ? { home: savedHome, away: savedAway }
      : null,
  )
  const [error, setError] = useState<string | null>(null)
  const [showSaved, setShowSaved] = useState(false)
  const [pending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Always call the latest drafts from timers without re-binding.
  const draftRef = useRef({ home, away })
  draftRef.current = { home, away }

  const homeScore = parseScore(home)
  const awayScore = parseScore(away)
  const bothValid = homeScore !== null && awayScore !== null
  const matchesSaved =
    lastSaved !== null && homeScore === lastSaved.home && awayScore === lastSaved.away
  const optimisticSaved = bothValid && (matchesSaved || pending)

  function persist(nextHome: number, nextAway: number) {
    if (lastSaved && lastSaved.home === nextHome && lastSaved.away === nextAway) return

    startTransition(async () => {
      const result = await savePredictionScores(fixtureId, nextHome, nextAway)
      if (result.error) {
        setError(result.error)
        setShowSaved(false)
        return
      }
      setError(null)
      setLastSaved({ home: nextHome, away: nextAway })
      setShowSaved(true)
      onSaved?.()
      if (savedFlashRef.current) clearTimeout(savedFlashRef.current)
      savedFlashRef.current = setTimeout(() => setShowSaved(false), 2500)
    })
  }

  function scheduleSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const h = parseScore(draftRef.current.home)
      const a = parseScore(draftRef.current.away)
      if (h === null || a === null) return
      persist(h, a)
    }, DEBOUNCE_MS)
  }

  function handleChange(side: "home" | "away", raw: string) {
    // Allow empty or digits only (score boxes shouldn't hold "e" / decimals).
    const cleaned = raw.replace(/[^0-9]/g, "").slice(0, 2)
    if (side === "home") setHome(cleaned)
    else setAway(cleaned)
    setError(null)
    setShowSaved(false)
    scheduleSave()
  }

  function handleBlur() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    const h = parseScore(draftRef.current.home)
    const a = parseScore(draftRef.current.away)
    if (h === null || a === null) return
    persist(h, a)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (savedFlashRef.current) clearTimeout(savedFlashRef.current)
    }
  }, [])

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <ScoreInput
          value={home}
          onChange={(v) => handleChange("home", v)}
          onBlur={handleBlur}
          saved={optimisticSaved}
          label="Home score"
        />
        <span className="text-ink-faint font-bold">–</span>
        <ScoreInput
          value={away}
          onChange={(v) => handleChange("away", v)}
          onBlur={handleBlur}
          saved={optimisticSaved}
          label="Away score"
        />
      </div>

      {/* Fixed-width status slot so feedback doesn't shove the inputs. */}
      <span className="w-16 shrink-0 text-xs leading-tight" role="status" aria-live="polite">
        {error ? (
          <span className="text-bad">{error}</span>
        ) : pending ? (
          <span className="inline-flex items-center gap-1 font-medium text-ink-muted">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-pitch/30 border-t-pitch"
            />
            Saving
          </span>
        ) : showSaved ? (
          <span className="font-medium text-pitch animate-pop">✓ Saved</span>
        ) : null}
      </span>
    </div>
  )
}

function ScoreInput({
  value,
  onChange,
  onBlur,
  saved,
  label,
}: {
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  saved: boolean
  label: string
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder="·"
      aria-label={label}
      className={`score-digits h-11 w-11 rounded-lg border-[1.5px] text-center text-xl transition-colors focus:outline-none focus:ring-2 focus:ring-pitch focus:border-pitch [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
        saved
          ? "border-pitch/50 bg-pitch-tint text-pitch-deep"
          : "border-line-strong bg-surface text-ink"
      }`}
    />
  )
}
