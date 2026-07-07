type SendEmailArgs = {
  to: string
  subject: string
  html: string
}

/**
 * Sends transactional email via Resend. Throws if RESEND_API_KEY/EMAIL_FROM
 * aren't configured or the send fails — unlike the optional deadline-reminder
 * sweep, callers of this helper (e.g. password reset) depend on the email
 * actually going out.
 */
export async function sendEmail({ to, subject, html }: SendEmailArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY / EMAIL_FROM must be configured to send email.")
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  })

  if (!res.ok) {
    throw new Error(`Failed to send email: ${res.status} ${await res.text()}`)
  }
}
