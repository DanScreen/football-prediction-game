/**
 * Email address format checking for sign-up and email changes.
 *
 * Deliberately pragmatic rather than a full RFC 5322 parser: it accepts every
 * address a real mailbox provider hands out and rejects the junk that actually
 * turns up in a sign-up form — no `@`, no domain dot, spaces, a one-letter TLD,
 * `name@gmail`, `a..b@x.com`. Whether the mailbox *exists* is settled by the
 * verification email, not here.
 *
 * The Expo app carries a copy of this check (`apps/mobile/lib/emailAddress.ts`)
 * for instant feedback; this one is the authority.
 */

const MAX_LENGTH = 254 // RFC 5321 path limit
const MAX_LOCAL_LENGTH = 64

// Dot-atom local part: printable specials allowed, dots only between atoms.
const LOCAL_PART = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/i
// A hostname label: alphanumerics and inner hyphens, 1–63 chars.
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
// Top-level domain: letters only (≥2), or an IDN in punycode form.
const TLD = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/i

/** Trim and lower-case, the form every address is stored and looked up in. */
export function normaliseEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : ""
}

/** True if `email` (already normalised) looks like a deliverable address. */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > MAX_LENGTH) return false

  const at = email.lastIndexOf("@")
  if (at <= 0 || at === email.length - 1) return false
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)

  if (local.length > MAX_LOCAL_LENGTH || !LOCAL_PART.test(local)) return false

  const labels = domain.split(".")
  if (labels.length < 2) return false
  const tld = labels[labels.length - 1]
  return labels.every((label) => DOMAIN_LABEL.test(label)) && TLD.test(tld)
}

/** The message shown whenever `isValidEmail` rejects an address. */
export const INVALID_EMAIL_MESSAGE = "Enter a valid email address, like you@example.com."
