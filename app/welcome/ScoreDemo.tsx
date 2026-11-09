"use client"

import { useState } from "react"
import { BANKER_MULTIPLIER, scoreOnePrediction } from "@/lib/scoring"

/** The fixture is fixed so the demo always reveals the same result. */
const FULL_TIME = { home: 2, away: 1 }
const START_PICK = { home: 1, away: 0 }

/** The demo league: the visitor's points are added to a base of 43. */
const BASE_POINTS = 43
const OTHERS = [
  { name: "Marcus", points: 48.5 },
  { name: "Elena", points: 45 },
  { name: "Robo", points: 44.5, bot: true },
  { name: "Priya", points: 43.5 },
]

const ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th"]
const PICKING_VERDICT =
  "Exact score is 3 points. Right result and one goal out is 1.5. Right result is 1."

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-board-gold"
const stepButton = `flex size-11 items-center justify-center rounded-[9px] border-[1.5px] border-board-fore/25 text-xl font-bold text-board-fore hover:bg-board-fore/10 ${focusRing}`

type Pick = { home: number; away: number }

function clampGoals(n: number) {
  return Math.max(0, Math.min(9, n))
}

function reasonFor(base: number) {
  if (base === 3) return "Exact score."
  if (base === 1.5) return "Right result, one goal out."
  if (base === 1) return "Right result."
  return "Wrong result."
}

export default function ScoreDemo({ displayClassName }: { displayClassName: string }) {
  const [pick, setPick] = useState<Pick>(START_PICK)
  const [banker, setBanker] = useState(false)
  const [done, setDone] = useState(false)

  // Scored with the real rule from lib/scoring.ts, never re-implemented here.
  const base = scoreOnePrediction(pick.home, pick.away, FULL_TIME.home, FULL_TIME.away)
  const gained = banker ? base * BANKER_MULTIPLIER : base

  const rows = [
    ...OTHERS.map((o) => ({ ...o, you: false })),
    { name: "You", points: BASE_POINTS + (done ? gained : 0), bot: false, you: true },
  ].sort((a, b) => b.points - a.points)
  const position = rows.findIndex((r) => r.you) + 1

  const shown = done ? FULL_TIME : pick

  // Any change after full time drops back to the picking state.
  function changeScore(side: keyof Pick, delta: number) {
    setDone(false)
    setPick((p) => ({ ...p, [side]: clampGoals(p[side] + delta) }))
  }

  function toggleBanker() {
    setDone(false)
    setBanker((b) => !b)
  }

  function whistle() {
    setDone((d) => !d)
  }

  const pointsLabel =
    banker && gained > 0 ? `${base} × ${BANKER_MULTIPLIER} = ${gained} pts` : `${gained} pts`

  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-board-fore/10 bg-board-panel p-4.5 shadow-2xl">
      <div className="flex items-center justify-between text-[0.7rem] font-bold tracking-[0.14em] text-board-muted uppercase">
        <span>{done ? "Full time" : "Your prediction"}</span>
        <span className="text-board-gold">
          {done ? `You said ${pick.home}–${pick.away}` : "Kick-off 16:30"}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
        <div className="flex min-w-0 flex-col items-center gap-2">
          <span className={`${displayClassName} text-2xl font-bold tracking-[0.03em] uppercase`}>
            Arsenal
          </span>
          <span className="w-[1.5em] rounded-[10px] bg-board py-[0.12em] text-center font-mono text-[clamp(3rem,8vw,4.4rem)] leading-none font-bold text-board-gold tabular-nums">
            {shown.home}
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              aria-label="Arsenal one fewer"
              className={stepButton}
              onClick={() => changeScore("home", -1)}
            >
              −
            </button>
            <button
              type="button"
              aria-label="Arsenal one more"
              className={stepButton}
              onClick={() => changeScore("home", 1)}
            >
              +
            </button>
          </span>
        </div>

        <span className="font-mono text-[2rem] text-board-muted">–</span>

        <div className="flex min-w-0 flex-col items-center gap-2">
          <span className={`${displayClassName} text-2xl font-bold tracking-[0.03em] uppercase`}>
            Chelsea
          </span>
          <span className="w-[1.5em] rounded-[10px] bg-board py-[0.12em] text-center font-mono text-[clamp(3rem,8vw,4.4rem)] leading-none font-bold text-board-gold tabular-nums">
            {shown.away}
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              aria-label="Chelsea one fewer"
              className={stepButton}
              onClick={() => changeScore("away", -1)}
            >
              −
            </button>
            <button
              type="button"
              aria-label="Chelsea one more"
              className={stepButton}
              onClick={() => changeScore("away", 1)}
            >
              +
            </button>
          </span>
        </div>
      </div>

      <button
        type="button"
        aria-pressed={banker}
        onClick={toggleBanker}
        className={`flex min-h-11 items-center justify-center gap-2 rounded-[9px] border-[1.5px] border-board-gold/50 bg-transparent px-2.5 py-2 text-sm font-bold text-board-gold aria-pressed:bg-board-gold aria-pressed:text-board ${focusRing}`}
      >
        {banker ? "★ Banker on · this one scores double" : "★ Make it my banker · double points"}
      </button>

      <button
        type="button"
        onClick={whistle}
        className={`min-h-11 rounded-[10px] bg-board-fore px-3 py-3 font-bold text-board ${focusRing}`}
      >
        {done ? "Try another score" : "Blow the full-time whistle"}
      </button>

      <div
        aria-live="polite"
        className="min-h-[3.2em] rounded-[10px] bg-board px-3 py-2.5 text-sm text-board-muted"
      >
        {done ? (
          <>
            <strong className="text-board-fore">
              Arsenal 2–1 Chelsea. {reasonFor(base)}
            </strong>{" "}
            <span className="font-mono font-bold text-board-gold">{pointsLabel}</span>. You are{" "}
            {ORDINALS[position]} of 5.{" "}
            {position > 1
              ? "An exact score with your banker on takes you top."
              : "Top of the league."}
          </>
        ) : (
          PICKING_VERDICT
        )}
      </div>

      <div className="flex flex-col border-t border-board-fore/10 pt-2">
        {rows.map((r, i) => (
          <div
            key={r.name}
            className={`grid grid-cols-[22px_1fr_auto] items-center gap-2 rounded-md px-1.5 py-1.5 text-sm ${
              r.you ? "bg-board-fore/10 font-bold" : ""
            }`}
          >
            <span className="font-mono text-board-muted">{i + 1}</span>
            <span>
              {r.name}
              {r.bot && (
                <span className="ml-1.5 rounded border border-board-muted px-1 text-[0.62rem] font-bold tracking-[0.08em] text-board-muted">
                  BOT
                </span>
              )}
              {r.you && done && gained > 0 && (
                <span className="ml-1.5 font-mono font-bold text-board-gold">+{gained}</span>
              )}
            </span>
            <span className="font-mono font-bold tabular-nums">{r.points}</span>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-board-muted">Example fixture and league, for the demo.</p>
    </div>
  )
}
