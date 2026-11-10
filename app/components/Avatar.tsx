import { avatarTone, initialsFor } from "@/lib/avatar"

/** Initials tones, indexed by `avatarTone()` — the app maps the same indices. */
const TONES = [
  "bg-pitch-tint text-pitch-deep",
  "bg-clock-tint text-clock",
  "bg-info-tint text-info",
  "bg-chip text-ink-mid",
]

const SIZES = {
  xs: "size-5 text-[9px]",
  sm: "size-7 text-[11px]",
  md: "size-9 text-sm",
  xl: "size-20 text-2xl",
} as const

/**
 * A player's profile picture, or their initials when they haven't uploaded
 * one. Decorative: it always sits next to the player's name, so it's hidden
 * from screen readers rather than announcing the name twice.
 */
export default function Avatar({
  userId,
  displayName,
  avatarUrl,
  size = "sm",
  className = "",
}: {
  userId: string
  displayName: string
  avatarUrl: string | null | undefined
  size?: keyof typeof SIZES
  className?: string
}) {
  const base = `inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-bold leading-none ${SIZES[size]} ${className}`

  if (avatarUrl) {
    return (
      // A plain <img>: the picture is already a small, fixed-size WebP served
      // with a year-long cache, so next/image's optimiser would add nothing.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className={`${base} bg-chip object-cover`}
      />
    )
  }

  return (
    <span aria-hidden="true" className={`${base} ${TONES[avatarTone(userId)]}`}>
      {initialsFor(displayName)}
    </span>
  )
}
