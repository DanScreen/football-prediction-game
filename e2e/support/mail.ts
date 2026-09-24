import { expect } from "@playwright/test"
import { MAIL_SINK_URL } from "../env"

type SentEmail = { id: string; to: string; subject: string; html: string; sentAt: string }

/**
 * Waits for an email to arrive in the mail sink and returns the first link in
 * it — the verification or reset link a real user would click.
 */
export async function linkFromLatestEmail(to: string, subject: RegExp): Promise<string> {
  let email: SentEmail | undefined
  await expect
    .poll(
      async () => {
        const res = await fetch(`${MAIL_SINK_URL}/emails?to=${encodeURIComponent(to)}`)
        const all = (await res.json()) as SentEmail[]
        email = all.filter((m) => subject.test(m.subject)).at(-1)
        return email?.subject ?? null
      },
      { message: `waiting for an email to ${to} matching ${subject}` },
    )
    .toMatch(subject)

  const href = email!.html.match(/href="([^"]+)"/)?.[1]
  if (!href) throw new Error(`No link in email "${email!.subject}" to ${to}`)
  return href
}
