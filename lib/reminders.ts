import { prisma } from "@/lib/prisma"
import { FixtureStatus } from "@/app/generated/prisma/client"
import { sendExpoPush } from "@/lib/expoPush"

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
 * Remind league members who haven't predicted fixtures kicking off within the
 * next 3 hours — via email (Resend) and/or Expo push. One batch per fixture
 * (claimed via reminderSentAt). Emails no-op without RESEND config; pushes
 * still go out when device tokens exist.
 */
export async function sendDeadlineReminders(): Promise<{
  sent: number
  pushSent: number
  skipped?: string
}> {
  const now = new Date()
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS)

  const due = await prisma.fixture.findMany({
    where: {
      status: FixtureStatus.SCHEDULED,
      kickoffTime: { gt: now, lte: windowEnd },
      reminderSentAt: null,
      // A finished competition is off the core pages, so nobody should be
      // nudged to go and predict on it.
      competition: { archivedAt: null },
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
  if (due.length === 0) return { sent: 0, pushSent: 0 }

  // Claim before sending so a concurrent sweep can't remind twice
  await prisma.fixture.updateMany({
    where: { id: { in: due.map((f) => f.id) }, reminderSentAt: null },
    data: { reminderSentAt: now },
  })

  const byUser = new Map<
    string,
    { email: string; displayName: string; fixtures: ReminderFixture[] }
  >()
  for (const f of due) {
    const predicted = new Set(f.predictions.map((p) => p.userId))
    const fixture: ReminderFixture = { ...f, competitionName: f.competition.name }
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

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  const appUrl = process.env.AUTH_URL ?? ""
  let sent = 0
  let emailSkipped: string | undefined

  if (!apiKey || !from) {
    emailSkipped = "RESEND_API_KEY / EMAIL_FROM not configured"
  } else {
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
  }

  const userIds = [...byUser.keys()]
  const devices =
    userIds.length === 0
      ? []
      : await prisma.mobileDeviceToken.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, expoPushToken: true },
        })

  const pushMessages = devices.map((d) => {
    const entry = byUser.get(d.userId)!
    const n = entry.fixtures.length
    const first = entry.fixtures[0]!
    const body =
      n === 1
        ? `${first.homeTeam} vs ${first.awayTeam} locks soon`
        : `${n} fixtures lock soon — make your picks`
    return {
      to: d.expoPushToken,
      title: "Predictions closing soon",
      body,
      data: { screen: "predictions" },
    }
  })

  const { sent: pushSent } = await sendExpoPush(pushMessages)

  return { sent, pushSent, skipped: emailSkipped }
}
