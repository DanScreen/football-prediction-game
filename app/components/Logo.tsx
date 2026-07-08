/**
 * The Scorers mark: a pitch-green scoreline chip — white digits, gold dash.
 * Chosen from the logo pitch (scoreline "treatment A"); the square favicon
 * variant lives in app/icon.png.
 */
export default function Logo({ className = "h-6 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 40" className={className} role="img" aria-label="Scorers logo">
      <rect width="60" height="40" rx="10" fill="#128749" />
      <text
        x="16"
        y="27"
        textAnchor="middle"
        fontFamily="var(--font-mono), ui-monospace, monospace"
        fontSize="19"
        fontWeight="700"
        fill="#ffffff"
      >
        2
      </text>
      <rect x="26" y="19" width="8" height="3" rx="1.5" fill="#f2c74e" />
      <text
        x="44"
        y="27"
        textAnchor="middle"
        fontFamily="var(--font-mono), ui-monospace, monospace"
        fontSize="19"
        fontWeight="700"
        fill="#ffffff"
      >
        1
      </text>
    </svg>
  )
}
