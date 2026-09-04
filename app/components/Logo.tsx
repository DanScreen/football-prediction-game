import {
  MARK_COLORS,
  MARK_DASH,
  MARK_DIGIT_PATHS,
  MARK_RADIUS,
  MARK_STROKE_WIDTH,
  MARK_VIEWBOX,
} from "@/lib/mark"

/**
 * The Scorers mark: a pitch-green scoreline chip — white digits, gold dash.
 * Geometry comes from `lib/mark.ts`, shared with the icon/splash/OG generator
 * (`npm run brand:assets`) so the header and the app icons can't drift apart.
 *
 * Colours are literal rather than tokens: the mark keeps its pitch green in both
 * themes, the way an app icon does.
 */
export default function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}
      className={className}
      role="img"
      aria-label="Scorers logo"
    >
      <rect
        width={MARK_VIEWBOX}
        height={MARK_VIEWBOX}
        rx={MARK_RADIUS}
        fill={MARK_COLORS.pitch}
      />
      <g
        fill="none"
        stroke={MARK_COLORS.white}
        strokeWidth={MARK_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {MARK_DIGIT_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <rect {...MARK_DASH} fill={MARK_COLORS.gold} />
    </svg>
  )
}
