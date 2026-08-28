/**
 * Native counterparts to the web's small scoreboard pieces —
 * `app/components/Countdown.tsx`, `BankerTag.tsx` and the `PointsBadge` inside
 * `app/PredictionHistory.tsx`. They are kept together because they share one
 * job: making a pick's state readable at a glance, in the same visual language
 * on both platforms. Colours come from `useTokens()`, so they follow the OS
 * theme exactly like the web's token swap does.
 */
import { useEffect, useState, type ReactNode } from "react"
import { Text, View, type TextStyle } from "react-native"
import { useTokens } from "@/lib/theme"

/** Tabular digits, so scores and countdowns line up — the web's `.score-digits`. */
export const scoreDigits: TextStyle = { fontVariant: ["tabular-nums"] }

export function Pill({
  children,
  bg,
  border,
  color,
}: {
  children: ReactNode
  bg: string
  border?: string
  color: string
}) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: bg,
        borderWidth: border ? 1 : 0,
        borderColor: border,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Text style={{ color, fontSize: 12, fontWeight: "700", ...scoreDigits }}>{children}</Text>
    </View>
  )
}

/** Time left until kickoff, or a locked chip once it has passed. */
export function Countdown({ kickoffTime }: { kickoffTime: string }) {
  const t = useTokens()
  const [label, setLabel] = useState(() => countdownLabel(kickoffTime))

  useEffect(() => {
    setLabel(countdownLabel(kickoffTime))
    const id = setInterval(() => setLabel(countdownLabel(kickoffTime)), 30_000)
    return () => clearInterval(id)
  }, [kickoffTime])

  const locked = label === null
  return (
    <Pill
      bg={locked ? t.badTint : t.clockTint}
      border={locked ? t.badLine : t.clockLine}
      color={locked ? t.bad : t.clock}
    >
      {locked ? "🔒 Locked" : label}
    </Pill>
  )
}

/** `null` once kickoff has passed. Mirrors the web countdown's d/h/m format. */
function countdownLabel(kickoffTime: string): string | null {
  const diff = new Date(kickoffTime).getTime() - Date.now()
  if (diff <= 0) return null
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const mins = Math.floor((diff % 3_600_000) / 60_000)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0 || days > 0) parts.push(`${hours}h`)
  parts.push(`${mins}m`)
  return parts.join(" ")
}

/** Read-only marker for the round's banker. The interactive one lives in FixtureCard. */
export function BankerTag() {
  const t = useTokens()
  return (
    <Pill bg={t.clockTint} border={t.clockLine} color={t.clock}>
      ★ ×2
    </Pill>
  )
}

/**
 * `points` is what was scored (doubled for a banker); `tone` is the undoubled
 * base — 3 / 1.5 / 1 / 0 — which picks the colour. A doubled 3 would otherwise
 * read as an ordinary 6.
 */
export function PointsBadge({ points, tone }: { points: number; tone: number }) {
  const t = useTokens()
  const [bg, border, color] =
    tone === 3
      ? [t.goodTint, t.goodLine, t.good]
      : tone === 1.5
        ? [t.infoTint, t.infoLine, t.info]
        : tone === 1
          ? [t.clockTint, t.clockLine, t.clock]
          : [t.chip, t.line, t.inkMuted]

  return (
    <Pill bg={bg} border={border} color={color}>
      {formatPoints(points)}
    </Pill>
  )
}

/** The exact-score celebration — the web's `animate-pop` "Nailed it! ⚽". */
export function NailedIt() {
  const t = useTokens()
  return (
    <Pill bg={t.goodTint} border={t.goodLine} color={t.good}>
      Nailed it! ⚽
    </Pill>
  )
}

/** Half-points are real (a "close" pick scores 1.5), so don't force integers. */
export function formatPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
