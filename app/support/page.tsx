import Link from "next/link"

export const metadata = {
  title: "Support",
  description:
    "Help with Scorers: getting into a league, making predictions, scoring, notifications, your account, and how to contact us.",
}

const SUPPORT_EMAIL = "support@scorersonline.uk"

/**
 * The support page behind the App Store / Play Store "Support URL" field.
 *
 * Both stores require a reachable support URL, and both expect it to answer real
 * questions and offer a way to contact a human — `/rules`, which the listing used
 * to point at, is the rules of the game and answers none of the "it isn't
 * working" questions. Public (in `PUBLIC_PATHS`), so a reviewer or a stuck user
 * can read it signed out.
 *
 * **Keep it true.** Every answer below names a specific place in the UI. When a
 * screen moves, fix it here in the same change — a support page that sends people
 * to a button that no longer exists is worse than no support page.
 */
export default function SupportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold text-ink">Support</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Help with the Scorers website and the Scorers iOS and Android apps. If the answer
          isn&apos;t here, email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-pitch hover:underline">
            {SUPPORT_EMAIL}
          </a>{" "}
          and a real person will reply.
        </p>
      </header>

      <div className="rounded-xl border border-line bg-surface px-5 py-4 shadow-card">
        <h2 className="text-sm font-bold text-ink">Contact us</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-mid">
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-pitch hover:underline">
            {SUPPORT_EMAIL}
          </a>{" "}
          — we aim to reply within two working days. Scorers is run by one person in the
          United Kingdom, so it may occasionally take a little longer.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-mid">
          If something is broken, telling us these four things gets it fixed much faster:
          the email address on your account, whether you were on the app or the website,
          your phone and OS version if it was the app, and what you expected to happen
          instead.
        </p>
      </div>

      <Section title="Getting started">
        <Question q="How do I join a league?">
          Two ways, depending on whether you already have an account. If a friend sends you
          an <strong className="text-ink">invite link</strong>, opening it creates your
          account and joins their league in one step. If you already have an account, ask
          them for the six-character <strong className="text-ink">invite code</strong> and
          enter it under &ldquo;Join with code&rdquo; on the Leagues tab (or{" "}
          <Link href="/leagues" className="font-medium text-pitch hover:underline">
            /leagues
          </Link>{" "}
          on the website).
        </Question>
        <Question q="My invite code doesn't work.">
          Codes are six characters and are not case-sensitive — we trim spaces and uppercase
          them for you, so <code className="text-ink">abc123</code> and{" "}
          <code className="text-ink">ABC123</code> both work. If it is still rejected, the
          most likely causes are a mistyped character, or that the competition the league
          plays has been declared finished — finished leagues are closed to new members. Ask
          your league admin to confirm the code from their Leagues tab.
        </Question>
        <Question q="I signed up but there's nothing to predict.">
          Predictions, results and the leaderboard all come from the leagues you are in, so
          a brand-new account with no league is empty by design. Create a league or join one
          and fixtures appear immediately.
        </Question>
      </Section>

      <Section title="Predictions">
        <Question q="When is the deadline?">
          Each fixture locks at its own <strong className="text-ink">kickoff time</strong>.
          There is no single weekly deadline — a match kicking off on Sunday is still open
          after Saturday&apos;s games have started and been scored.
        </Question>
        <Question q="Do I have to press save?">
          No. In the app your scoreline saves by itself a moment after you stop typing, and
          a tick confirms it. If a save fails (usually a dropped connection) the card tells
          you so and you can retype it.
        </Question>
        <Question q="What is the banker?">
          One fixture per gameweek that you nominate to score double. Predict the fixture
          first, then star it — starring a different one moves the banker rather than adding
          a second. You can move it freely until the fixture you have bankered kicks off;
          after that it is locked for the rest of the round, even on matches still to come.
        </Question>
        <Question q="Can I change a prediction?">
          As often as you like, right up until that fixture kicks off. After kickoff it is
          locked and becomes visible to your league-mates.
        </Question>
        <Question q="Why can I see other people's predictions?">
          Only after a fixture has kicked off, and only from people in a league with you.
          Before kickoff nobody can see your pick. That is the game working as intended.
        </Question>
      </Section>

      <Section title="Scoring and results">
        <Question q="How are points worked out?">
          The full points table, the banker, and the streak bonus are all explained on{" "}
          <Link href="/rules" className="font-medium text-pitch hover:underline">
            How it works
          </Link>
          . Those numbers are platform-wide — they are the same in every league.
        </Question>
        <Question q="A match has finished but my points haven't appeared.">
          Results are picked up automatically a couple of hours after the final whistle, and
          until they are confirmed the score shows as{" "}
          <strong className="text-ink">provisional</strong> with provisional points. If a
          result is still missing well after that, the feed we use may not have published it
          yet, or the match may need a host to confirm it by hand. Email us and we will look.
        </Question>
        <Question q="My points went down.">
          This is rare but real. If a scoreline is corrected after we first read it —
          for example a goal later disallowed — every prediction on that fixture is
          rescored automatically (the feed is re-checked for a day after kickoff), and
          because the streak bonus counts correct results across a whole gameweek, a
          correction can also move you between bonus tiers. The leaderboard always
          reflects the current confirmed scores.
        </Question>
        <Question q="A competition I used to play has disappeared.">
          When a season is over, a host can mark the competition{" "}
          <strong className="text-ink">finished</strong>. It then leaves Predictions, Results
          and the leaderboard so it stops crowding the current season. Nothing is deleted —
          the league moves to the &ldquo;Finished&rdquo; section of your Leagues tab and the
          final table is still there.
        </Question>
      </Section>

      <Section title="Notifications and email">
        <Question q="What will you send me?">
          A reminder about three hours before kickoff when you have fixtures in the next
          round you have not predicted, and password-reset emails when you ask for one.
          Nothing else — no marketing, ever.
        </Question>
        <Question q="I'm not getting reminders.">
          On the phone, check that notifications are allowed for Scorers in your device
          settings; the app asks once and cannot ask again if you declined. For email,
          check the spam folder. Note that reminders only go out when you actually have an
          unpredicted fixture coming up.
        </Question>
        <Question q="How do I turn them off?">
          Turn notifications off for Scorers in your device settings — that is enough, and we
          stop sending to that device.
        </Question>
      </Section>

      <Section title="Your account">
        <Question q="I've forgotten my password.">
          Use{" "}
          <Link href="/forgot-password" className="font-medium text-pitch hover:underline">
            forgot password
          </Link>{" "}
          (the app links to the same page). The link we email is valid for one hour and can
          be used once.
        </Question>
        <Question q="Where is my account screen in the app?">
          Tap the <strong className="text-ink">person icon in the top-right corner</strong>{" "}
          of any tab. Your display name, email, sign-out and account deletion all live there.
        </Question>
        <Question q="How do I delete my account?">
          In the app: person icon (top right) → <strong className="text-ink">Delete
          account</strong>. On the website:{" "}
          <Link href="/profile" className="font-medium text-pitch hover:underline">
            your profile page
          </Link>{" "}
          → Delete account. It is immediate and permanent — there is no deactivated state
          and no grace period. It removes your account, predictions, points, league
          memberships, push tokens and sessions. Leagues you started stay open for their
          other members; a league left with nobody in it is deleted too.
        </Question>
        <Question q="What do you do with my data?">
          Short version: only what is needed to run the game, with no advertising, tracking
          or analytics of any kind. The detail is in the{" "}
          <Link href="/privacy" className="font-medium text-pitch hover:underline">
            privacy policy
          </Link>
          .
        </Question>
      </Section>

      <Section title="Reporting a problem">
        <p>
          Bugs, a result you think is scored wrongly, a league that has gone strange, or
          anything you would like Scorers to do — email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-pitch hover:underline">
            {SUPPORT_EMAIL}
          </a>
          . There is no ticket system and no bot; it goes to a person who works on the app.
        </p>
      </Section>

      <p className="border-t border-line-soft pt-5 text-center text-xs text-ink-muted">
        <Link href="/rules" className="font-medium text-pitch hover:underline">
          How it works
        </Link>
        {" · "}
        <Link href="/privacy" className="font-medium text-pitch hover:underline">
          Privacy policy
        </Link>
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-bold text-ink">{title}</h2>
      <div className="space-y-4 text-sm leading-relaxed text-ink-mid">{children}</div>
    </section>
  )
}

function Question({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold text-ink">{q}</h3>
      <p className="mt-1">{children}</p>
    </div>
  )
}
