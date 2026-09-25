/**
 * The branded shell every Scorers email is rendered into, plus the small
 * building blocks templates compose inside it. Templates live in
 * `lib/emailTemplates.ts`; nothing should hand `sendEmail` hand-written HTML.
 *
 * Email HTML is its own world: table layout and inline styles only (Outlook and
 * Gmail ignore <style> blocks and most modern CSS), and colours are literal hexes
 * because CSS variables don't exist there. The hexes mirror the light-theme
 * tokens in `app/globals.css` and the mark colours in `lib/mark.ts`.
 */

/** Light "Quiet Product" palette, with the deep-green scoreboard for the header. */
export const EMAIL_COLORS = {
  ground: "#f7f8f7",
  surface: "#ffffff",
  chip: "#eef1ee",
  ink: "#17201b",
  inkMid: "#3d4842",
  inkMuted: "#5e6b63",
  line: "#e4e8e4",
  pitch: "#128749",
  pitchTint: "#eaf4ee",
  pitchOn: "#ffffff",
  clock: "#b45309",
  clockTint: "#fdf3e7",
  clockLine: "#f0d3a8",
  board: "#0f4527",
  boardPanel: "#175c36",
  boardFore: "#eef7f1",
  boardMuted: "#a9c9b6",
  boardGold: "#f2c74e",
} as const

const SANS = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const MONO = "'Geist Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Absolute origin for links and images. Pinned to the custom domain in prod. */
export function appUrl(): string {
  return process.env.AUTH_URL ?? ""
}

/** Generated from `lib/mark.ts` by `npm run brand:assets`. */
export function emailLogoUrl(): string {
  return `${appUrl()}/brand/email-logo.png`
}

/** What a template hands to `sendEmail`. */
export type EmailContent = {
  subject: string
  html: string
  /** Plain-text alternative, for clients that don't render HTML. */
  text: string
}

type LayoutParams = {
  /** Inbox preview snippet, hidden in the body. */
  preheader: string
  /** Small uppercase label above the title. */
  eyebrow: string
  title: string
  /** Trusted HTML — escape anything user-supplied before it gets here. */
  bodyHtml: string
  cta?: {
    label: string
    url: string
    /**
     * Repeats the URL as copyable text under the button. Use it where a button
     * that won't render leaves the reader stuck (verification, password reset).
     */
    showFallbackUrl?: boolean
  }
  /** Trusted HTML shown small above the standard footer. */
  footerNote?: string
}

/**
 * Renders a complete email: scoreboard-green header with the mark and wordmark,
 * a white card holding the eyebrow/title/body/button, and a quiet footer.
 *
 * The header is deliberately not a link, so the call-to-action is always the
 * first link in the email (the e2e mail helper follows the first href).
 */
export function renderEmail(params: LayoutParams): string {
  const c = EMAIL_COLORS
  const home = appUrl()

  const cta = params.cta
    ? `<tr>
            <td style="padding:8px 32px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-radius:10px;background-color:${c.pitch};">
                    <a href="${escapeHtml(params.cta.url)}" style="display:inline-block;padding:14px 26px;font-family:${SANS};font-size:15px;font-weight:700;color:${c.pitchOn};text-decoration:none;border-radius:10px;">${escapeHtml(params.cta.label)}&nbsp;&rarr;</a>
                  </td>
                </tr>
              </table>
              ${
                params.cta.showFallbackUrl
                  ? `<p style="margin:18px 0 0;font-family:${SANS};font-size:12px;line-height:1.5;color:${c.inkMuted};">Button not working? Paste this into your browser:<br/><span style="color:${c.pitch};word-break:break-all;">${escapeHtml(params.cta.url)}</span></p>`
                  : ""
              }
            </td>
          </tr>`
    : ""

  const footerNote = params.footerNote
    ? `<p style="margin:0 0 10px;font-size:12px;line-height:1.55;color:${c.inkMuted};">${params.footerNote}</p>`
    : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<meta name="supported-color-schemes" content="light"/>
<title>${escapeHtml(params.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${c.ground};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${c.ground};">${escapeHtml(params.preheader)}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${c.ground};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${c.surface};border:1px solid ${c.line};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background-color:${c.board};padding:22px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:14px;">
                    <img src="${emailLogoUrl()}" width="44" height="44" alt="" style="display:block;border:0;border-radius:10px;"/>
                  </td>
                  <td style="vertical-align:middle;font-family:${SANS};">
                    <div style="font-size:22px;font-weight:800;letter-spacing:-0.03em;line-height:1.1;color:${c.boardFore};">Scorers</div>
                    <div style="margin-top:3px;font-size:12px;line-height:1.3;color:${c.boardMuted};">Predict the score. Beat your mates.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="height:4px;background-color:${c.boardGold};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 32px 4px;font-family:${SANS};">
              <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${c.pitch};">${escapeHtml(params.eyebrow)}</p>
              <h1 style="margin:0;font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:${c.ink};">${escapeHtml(params.title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 12px;font-family:${SANS};font-size:15px;line-height:1.6;color:${c.inkMid};">
              ${params.bodyHtml}
            </td>
          </tr>
          ${cta}
          <tr>
            <td style="padding:22px 32px 26px;background-color:${c.chip};border-top:1px solid ${c.line};font-family:${SANS};">
              ${footerNote}
              <p style="margin:0;font-size:12px;line-height:1.55;color:${c.inkMuted};">
                <strong style="color:${c.inkMid};">Scorers</strong> &middot; score predictions with friends${
                  home
                    ? ` &middot; <a href="${escapeHtml(home)}" style="color:${c.pitch};text-decoration:underline;">Open Scorers</a>`
                    : ""
                }
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** A body paragraph. Takes trusted HTML. */
export function paragraph(html: string): string {
  return `<p style="margin:0 0 14px;">${html}</p>`
}

/** Smaller, muted aside (expiry notes, "ignore this if..."). Takes trusted HTML. */
export function mutedNote(html: string): string {
  return `<p style="margin:0 0 14px;font-size:13px;line-height:1.55;color:${EMAIL_COLORS.inkMuted};">${html}</p>`
}

/**
 * A mini scoreboard card for one fixture: teams either side of a gold "? – ?"
 * waiting for a prediction, with the kickoff in an amber chip (amber means
 * "deadline" everywhere in Scorers).
 */
export function fixtureCard(f: {
  homeTeam: string
  awayTeam: string
  kickoffLabel: string
  context: string
}): string {
  const c = EMAIL_COLORS
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;border-collapse:separate;background-color:${c.board};border-radius:12px;">
    <tr>
      <td style="padding:16px 18px 6px;font-family:${SANS};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="40%" style="font-size:15px;font-weight:700;line-height:1.3;color:${c.boardFore};">${escapeHtml(f.homeTeam)}</td>
            <td width="20%" align="center" style="font-family:${MONO};font-size:18px;font-weight:700;white-space:nowrap;color:${c.boardGold};">?&nbsp;&ndash;&nbsp;?</td>
            <td width="40%" align="right" style="font-size:15px;font-weight:700;line-height:1.3;color:${c.boardFore};">${escapeHtml(f.awayTeam)}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:6px 18px 16px;font-family:${SANS};">
        <span style="display:inline-block;padding:3px 9px;border-radius:999px;background-color:${c.clockTint};border:1px solid ${c.clockLine};font-size:12px;font-weight:700;color:${c.clock};">Locks ${escapeHtml(f.kickoffLabel)}</span>
        <span style="font-size:12px;color:${c.boardMuted};">&nbsp; ${escapeHtml(f.context)}</span>
      </td>
    </tr>
  </table>`
}
