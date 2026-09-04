"use client"

import { useState } from "react"
import Countdown from "@/app/components/Countdown"
import PredictionInput from "@/app/components/PredictionInput"
import BankerButton from "@/app/components/BankerButton"

/**
 * Open fixture card: auto-saving score inputs + banker. Client-owned so the
 * amber/green edge and Banker enable as soon as a pick is saved, without
 * waiting for the server tree to refresh.
 */
export default function OpenFixtureCard({
  fixtureId,
  homeTeam,
  awayTeam,
  kickoffIso,
  kickoffLabel,
  savedHome,
  savedAway,
  isBanker,
}: {
  fixtureId: string
  homeTeam: string
  awayTeam: string
  kickoffIso: string
  kickoffLabel: string
  savedHome?: number
  savedAway?: number
  isBanker: boolean
}) {
  const initiallySaved = savedHome !== undefined && savedAway !== undefined
  const [hasPrediction, setHasPrediction] = useState(initiallySaved)

  return (
    <div
      className={`bg-surface rounded-xl border shadow-card overflow-hidden border-l-4 ${
        hasPrediction ? "border-line border-l-pitch/40" : "border-clock-line border-l-clock"
      }`}
    >
      <div className="flex items-center justify-between gap-4 border-b border-line-soft px-5 py-2.5">
        <p className="min-w-0 truncate text-xs font-medium text-ink-muted">{kickoffLabel}</p>
        <div className="shrink-0">
          <Countdown kickoffTime={kickoffIso} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <p className="order-1 min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
          {homeTeam}
        </p>
        <div className="order-3 flex w-full justify-center sm:order-2 sm:w-auto">
          <PredictionInput
            fixtureId={fixtureId}
            savedHome={savedHome}
            savedAway={savedAway}
            onSaved={() => setHasPrediction(true)}
          />
        </div>
        <p className="order-2 min-w-0 flex-1 truncate text-right text-[15px] font-semibold text-ink sm:order-3">
          {awayTeam}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft px-5 py-2">
        <BankerButton
          fixtureId={fixtureId}
          isBanker={isBanker}
          hasPrediction={hasPrediction}
        />
      </div>
    </div>
  )
}
