/**
 * Renders every email template with sample data into `.email-previews/`, so a
 * template change can be checked in a browser before it reaches an inbox.
 *
 *   npm run email:preview
 *
 * The logo points at AUTH_URL, which may not serve it yet (local dev, or a new
 * asset before deploy), so the preview inlines the committed PNG instead.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { emailLogoUrl, type EmailContent } from "../lib/emailLayout"
import { deadlineReminderEmail, passwordResetEmail, verificationEmail } from "../lib/emailTemplates"

process.env.AUTH_URL ||= "https://scorers.example"

const ROOT = join(import.meta.dirname, "..")
const OUT = join(ROOT, ".email-previews")
const logo = `data:image/png;base64,${readFileSync(join(ROOT, "public/brand/email-logo.png")).toString("base64")}`

const soon = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000)

const emails: Record<string, EmailContent> = {
  verification: verificationEmail({
    displayName: "Alex",
    link: `${process.env.AUTH_URL}/verify-email/${"a1".repeat(32)}`,
  }),
  "password-reset": passwordResetEmail({
    displayName: "Alex",
    link: `${process.env.AUTH_URL}/reset-password/${"b2".repeat(32)}`,
  }),
  "deadline-reminder": deadlineReminderEmail({
    displayName: "Alex",
    fixtures: [
      { homeTeam: "Arsenal", awayTeam: "Chelsea", kickoffTime: soon(1), competitionName: "Premier League", round: "Matchweek 6" },
      { homeTeam: "Brighton & Hove Albion", awayTeam: "Newcastle United", kickoffTime: soon(2.5), competitionName: "Premier League", round: "Matchweek 6" },
    ],
  }),
}

mkdirSync(OUT, { recursive: true })
for (const [name, email] of Object.entries(emails)) {
  writeFileSync(join(OUT, `${name}.html`), email.html.split(emailLogoUrl()).join(logo))
  writeFileSync(join(OUT, `${name}.txt`), `Subject: ${email.subject}\n\n${email.text}\n`)
  console.log(`  .email-previews/${name}.html  — ${email.subject}`)
}
