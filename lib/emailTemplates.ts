/**
 * Every email Scorers sends. Each template returns subject + branded HTML +
 * plain text, all rendered through `renderEmail` so they share one look.
 * Add new emails here rather than building HTML at the call site.
 */
import {
  appUrl,
  escapeHtml,
  fixtureCard,
  mutedNote,
  paragraph,
  renderEmail,
  type EmailContent,
} from "@/lib/emailLayout"

export function verificationEmail(p: { displayName: string; link: string }): EmailContent {
  const name = escapeHtml(p.displayName)
  return {
    subject: "Confirm your email for Scorers",
    html: renderEmail({
      preheader: "One tap and you're ready for kick-off.",
      eyebrow: "Welcome to Scorers",
      title: "You're one tap from kick-off",
      bodyHtml: [
        paragraph(`Hi ${name},`),
        paragraph(
          "Confirm this is your email address to finish setting up your account. Then it's " +
            "straight to the fun part: calling scores, playing your banker and climbing the table.",
        ),
        mutedNote(
          "The link works once and expires in 24 hours. If you didn't sign up for Scorers, you can ignore this email.",
        ),
      ].join(""),
      cta: { label: "Confirm my email", url: p.link, showFallbackUrl: true },
    }),
    text: [
      `Hi ${p.displayName},`,
      "",
      "Confirm this is your email address to finish setting up your Scorers account:",
      p.link,
      "",
      "The link works once and expires in 24 hours. If you didn't sign up for Scorers, you can ignore this email.",
    ].join("\n"),
  }
}

export function passwordResetEmail(p: { displayName: string; link: string }): EmailContent {
  const name = escapeHtml(p.displayName)
  return {
    subject: "Reset your Scorers password",
    html: renderEmail({
      preheader: "Choose a new password. This link expires in 1 hour.",
      eyebrow: "Password reset",
      title: "Back in the game",
      bodyHtml: [
        paragraph(`Hi ${name},`),
        paragraph("Someone (hopefully you) asked to reset your Scorers password. Choose a new one below."),
        mutedNote(
          "This link expires in 1 hour and can only be used once. If you didn't ask for this, you can ignore this email and your password stays the same.",
        ),
      ].join(""),
      cta: { label: "Choose a new password", url: p.link, showFallbackUrl: true },
    }),
    text: [
      `Hi ${p.displayName},`,
      "",
      "Someone (hopefully you) asked to reset your Scorers password. Choose a new one here:",
      p.link,
      "",
      "This link expires in 1 hour and can only be used once. If you didn't ask for this, you can ignore this email.",
    ].join("\n"),
  }
}

export type ReminderEmailFixture = {
  homeTeam: string
  awayTeam: string
  kickoffTime: Date
  competitionName: string
  round: string
}

function kickoffLabel(date: Date): string {
  return date.toLocaleString("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function deadlineReminderEmail(p: {
  displayName: string
  fixtures: ReminderEmailFixture[]
}): EmailContent {
  const n = p.fixtures.length
  const plural = n === 1 ? "" : "s"
  const cards = p.fixtures
    .map((f) =>
      fixtureCard({
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
        kickoffLabel: kickoffLabel(f.kickoffTime),
        context: `${f.competitionName} · ${f.round}`,
      }),
    )
    .join("")
  const home = appUrl()

  return {
    subject: `⚽ ${n} prediction${plural} closing soon!`,
    html: renderEmail({
      preheader:
        n === 1
          ? `${p.fixtures[0]!.homeTeam} vs ${p.fixtures[0]!.awayTeam} locks at kickoff.`
          : `${n} fixtures lock at kickoff. Get your picks in.`,
      eyebrow: "Deadline approaching",
      title: n === 1 ? "The clock's ticking on this one" : `${n} matches still need your call`,
      bodyHtml: [
        paragraph(`Hi ${escapeHtml(p.displayName)},`),
        paragraph(
          `You haven't predicted ${n === 1 ? "this fixture" : "these fixtures"} yet, and predictions lock at kickoff:`,
        ),
        `<div style="margin:18px 0 8px;">${cards}</div>`,
        mutedNote("Exact score = 3 points. Don't forget your banker ★ doubles one pick."),
      ].join(""),
      cta: home ? { label: "Make your picks", url: home } : undefined,
    }),
    text: [
      `Hi ${p.displayName},`,
      "",
      `You haven't predicted ${n === 1 ? "this fixture" : "these fixtures"} yet, and predictions lock at kickoff:`,
      "",
      ...p.fixtures.map(
        (f) =>
          `- ${f.homeTeam} vs ${f.awayTeam}: locks ${kickoffLabel(f.kickoffTime)} (${f.competitionName} · ${f.round})`,
      ),
      "",
      ...(home ? [`Make your picks: ${home}`] : []),
    ].join("\n"),
  }
}
