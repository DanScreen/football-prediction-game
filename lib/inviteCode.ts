/** 6 chars from an unambiguous alphabet (no I/O/0/1). */
export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

/**
 * Codes are generated uppercase, so every lookup must normalise the same way.
 *
 * Registration used to `.trim()` only while the join form did `.trim().toUpperCase()`,
 * meaning a lowercase code was rejected at sign-up but accepted when joining. Both
 * paths now go through here.
 */
export function normaliseInviteCode(raw: string | null | undefined): string {
  return String(raw ?? "").trim().toUpperCase()
}

/** The query parameter carrying an invite on `/register`. */
export const INVITE_PARAM = "invite"

/** The shareable sign-up link for a league, e.g. `https://scorersonline.uk/register?invite=ABC234`. */
export function inviteUrl(origin: string, inviteCode: string): string {
  return `${origin.replace(/\/$/, "")}/register?${INVITE_PARAM}=${encodeURIComponent(inviteCode)}`
}
