import { prisma } from "@/lib/prisma"
import { FixtureStatus } from "@/app/generated/prisma/client"

/** How far ahead of kickoff the reminder window opens. */
const REMINDER_WINDOW_MS = 3 * 60 * 60 * 1000

type ReminderFixture = {
  id: string
  competitionName: string
  round: string
  homeTeam: string
  awayTeam: string
  kickoffTime: Date
}

/**
 * Email league members who haven't predicted fixtures kicking off within the
 * next 3 hours. One email per user per sweep, listing all their open fixtures.
 * No-ops unless RESEND_API_KEY and EMAIL_FROM are configured. Each fixture is
 * claimed via reminderSentAt before sending, so a fixture only ever triggers
 * one reminder batch.
 */
export async function sendDeadlineReminders(): Promise<{ sent: number; skipped?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) return { sent: 0, skipped: "RESEND_API_KEY / EMAIL_FROM not configured" }

  const now = new Date()
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS)

  const due = await prisma.fixture.findMany({
    where: {
      status: FixtureStatus.SCHEDULED,
      kickoffTime: { gt: now, lte: windowEnd },
      reminderSentAt: null,
    },
    include: {
      predictions: { select: { userId: true } },
      competition: {
        select: {
          name: true,
          leagues: {
            select: {
              memberships: {
                select: {
                  user: { select: { id: true, email: true, displayName: true, isBot: true } },
                },
              },
            },
          },
        },
      },
    },
  })
  if (due.length === 0) return { sent: 0 }

  // Claim before sending so a concurrent sweep can't email twice
  await prisma.fixture.updateMany({
    where: { id: { in: due.map((f) => f.id) }, reminderSentAt: null },
    data: { reminderSentAt: now },
  })

  const byUser = new Map<string, { email: string; displayName: string; fixtures: ReminderFixture[] }>()
  for (const f of due) {
    const predicted = new Set(f.predictions.map((p) => p.userId))
    const fixture: ReminderFixture = { ...f, competitionName: f.competition.name }
    // A user in several leagues on this competition appears once — the map
    // dedupes, and a fixture is only added on their first appearance
    const seenForFixture = new Set<string>()
    for (const league of f.competition.leagues) {
      for (const { user } of league.memberships) {
        if (user.isBot || predicted.has(user.id) || seenForFixture.has(user.id)) continue
        seenForFixture.add(user.id)
        const entry = byUser.get(user.id) ?? {
          email: user.email,
          displayName: user.displayName,
          fixtures: [],
        }
        entry.fixtures.push(fixture)
        byUser.set(user.id, entry)
      }
    }
  }

  const appUrl = process.env.AUTH_URL ?? ""
  let sent = 0

  for (const [, { email, displayName, fixtures }] of byUser) {
    const rows = fixtures
      .map(
        (f) =>
          `<li><strong>${f.homeTeam} vs ${f.awayTeam}</strong> — kicks off ${f.kickoffTime.toLocaleString(
            "en-GB",
            { timeZone: "Europe/London", weekday: "short", hour: "2-digit", minute: "2-digit" },
          )} (${f.competitionName} · ${f.round})</li>`,
      )
      .join("")

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: email,
        subject: `⚽ ${fixtures.length} prediction${fixtures.length === 1 ? "" : "s"} closing soon!`,
        html: `<p>Hi ${displayName},</p>
<p>You haven't predicted these fixtures yet, and they lock at kickoff:</p>
<ul>${rows}</ul>
<p><a href="${appUrl}">Make your picks now</a> before the deadline! 🏆</p>`,
      }),
    })
    if (res.ok) sent++
  }

  return { sent }
}
