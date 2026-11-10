/**
 * A points figure as a pill. `points` is what was scored (doubled for a banker);
 * `tone` is the undoubled base — 3 / 1.5 / 1 / 0 — which picks the colour, so a
 * doubled 3 doesn't read as an ordinary 6.
 */
export default function PointsBadge({ points, tone }: { points: number; tone: number }) {
  const color =
    tone === 3
      ? "bg-good-tint text-good border border-good-line"
      : tone === 1.5
        ? "bg-info-tint text-info border border-info-line"
        : tone === 1
          ? "bg-clock-tint text-clock border border-clock-line"
          : "bg-chip text-ink-muted border border-line"

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-sm font-bold tabular-nums ${color}`}>
      {points}
    </span>
  )
}
