/**
 * Profile-picture helpers that are safe anywhere (no Node or Prisma imports).
 *
 * MIRROR: `apps/mobile/lib/avatar.ts` is an identical copy for the app (the
 * root vitest can't transform files under `apps/mobile` in CI). A test checks
 * the two stay the same — edit both together.
 *
 * Every player has an avatar: their uploaded picture if they set one, otherwise
 * their initials on a tone picked from their id. Picking by id rather than name
 * keeps someone's colour stable when they rename themselves.
 */

/** The avatar tones, in order. Each platform maps an index to its own tokens. */
export const AVATAR_TONE_COUNT = 4

/**
 * Up to two initials: first and last word for a multi-word name ("Dan
 * Screen" → "DS"), the first letter for a single word ("dan" → "D"). Works on
 * whole characters, so an emoji or accented letter isn't split in half.
 */
export function initialsFor(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  const first = Array.from(words[0])[0]
  if (words.length === 1) return first.toUpperCase()
  const last = Array.from(words[words.length - 1])[0]
  return (first + last).toUpperCase()
}

/** A stable tone index in [0, AVATAR_TONE_COUNT) for a user id. */
export function avatarTone(userId: string): number {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % AVATAR_TONE_COUNT
}

/** The site-relative URL of an uploaded picture, or null when there is none. */
export function avatarPath(avatarKey: string | null | undefined): string | null {
  return avatarKey ? `/api/avatars/${avatarKey}` : null
}
