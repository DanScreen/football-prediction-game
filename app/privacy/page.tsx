import Link from "next/link"

export const metadata = {
  title: "Privacy policy",
  description:
    "What data Scorers collects, why, who it is shared with, and how to delete your account.",
}

/**
 * The privacy policy, kept deliberately short and specific.
 *
 * It exists because the App Store and Play Store both require a reachable
 * privacy-policy URL for a listing, and `/rules` — which the store-release doc
 * previously pointed at — is the rules of the game, not a policy. Public, so a
 * store reviewer can open it without an account.
 *
 * **Keep it true.** If the app starts collecting something new, or a processor
 * changes, edit this page in the same change. A policy that describes the app
 * as it used to be is worse than none, and Apple treats a mismatch between the
 * privacy labels and this page as a rejection.
 */
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold text-ink">Privacy policy</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Last updated 10 November 2026. This policy covers the Scorers website at
          scorersonline.uk and the Scorers iOS and Android apps.
        </p>
      </header>

      <Section title="Who we are">
        <p>
          Scorers is a small football score-prediction game run by an individual in the
          United Kingdom. There is no company behind it and no advertising business
          attached to it. Questions about this policy, or about your data, go to{" "}
          <a href="mailto:privacy@scorersonline.uk" className="font-medium text-pitch hover:underline">
            privacy@scorersonline.uk
          </a>
          .
        </p>
      </Section>

      <Section title="What we collect">
        <ul className="space-y-2">
          <Bullet>
            <strong className="text-ink">Your account</strong> — the email address, display
            name and password you give us when you register. The password is stored only as
            a bcrypt hash; we never see or store the password itself.
          </Bullet>
          <Bullet>
            <strong className="text-ink">A profile picture</strong>, only if you choose to add
            one. We crop and shrink it to a small square and remove its metadata (including
            any location the camera recorded) before storing it. Remove it at any time from
            your profile, and your initials show instead.
          </Bullet>
          <Bullet>
            <strong className="text-ink">Your gameplay</strong> — the score predictions you
            submit, which fixture you nominated as your banker, the points those picks
            scored, and which leagues you belong to.
          </Bullet>
          <Bullet>
            <strong className="text-ink">Notification tokens</strong> — if you allow
            notifications in the mobile app, the push token your device issues, so we can
            send you a reminder about a fixture you have not predicted.
          </Bullet>
          <Bullet>
            <strong className="text-ink">Session tokens</strong> — a login cookie on the
            website, and access/refresh tokens stored in the device keychain in the apps.
          </Bullet>
          <Bullet>
            <strong className="text-ink">An API key</strong>, if you use the public bot API.
          </Bullet>
        </ul>
        <p className="mt-3">
          We do <strong className="text-ink">not</strong> collect your location, contacts,
          any photos other than a profile picture you choose, device identifiers for advertising, or any analytics or behavioural
          tracking. There are no third-party trackers, advertising SDKs or analytics SDKs in
          the website or in the apps.
        </p>
      </Section>

      <Section title="Why we use it">
        <ul className="space-y-2">
          <Bullet>To create and secure your account, and to sign you in.</Bullet>
          <Bullet>
            To run the game: scoring your predictions and placing you on the leaderboards of
            the leagues you have joined.
          </Bullet>
          <Bullet>
            To email you when you ask us to — a password reset, or a deadline reminder for a
            fixture you have not yet predicted.
          </Bullet>
          <Bullet>To send the push reminders you opted into, if you opted in.</Bullet>
        </ul>
        <p className="mt-3">
          The lawful basis is performance of a contract (running the game you signed up for)
          and, for reminders, your consent — which you can withdraw at any time by turning
          notifications off for Scorers in your device settings.
        </p>
      </Section>

      <Section title="Who can see it">
        <p>
          Your display name, your profile picture if you add one, your predictions once a
          fixture has kicked off, and your points are visible to the other members of the leagues you join. That is the game. Your
          email address is never shown to other players.
        </p>
        <p className="mt-3">We use these processors, and no others:</p>
        <ul className="mt-2 space-y-2">
          <Bullet>
            <strong className="text-ink">Google Cloud Platform</strong> (London,
            europe-west2) — hosting and the database.
          </Bullet>
          <Bullet>
            <strong className="text-ink">Cloudflare</strong> — the proxy in front of the
            site.
          </Bullet>
          <Bullet>
            <strong className="text-ink">Resend</strong> — sending transactional email.
          </Bullet>
          <Bullet>
            <strong className="text-ink">Expo</strong> — delivering push notifications to
            your device.
          </Bullet>
          <Bullet>
            <strong className="text-ink">football-data.org</strong> — the source of fixtures
            and results. Nothing about you is sent to them.
          </Bullet>
        </ul>
        <p className="mt-3">
          We do not sell your data, and we do not share it for advertising or marketing by
          anyone.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Your account and its predictions are kept while your account exists. Password-reset
          tokens expire within an hour and are deleted when used. Refresh tokens are deleted
          when you sign out. Push tokens are deleted when you turn notifications off or
          delete your account.
        </p>
      </Section>

      <Section title="Deleting your account">
        <p>
          You can delete your account at any time, and the deletion is immediate and
          permanent — there is no deactivated state and no grace period.
        </p>
        <ul className="mt-2 space-y-2">
          <Bullet>
            <strong className="text-ink">In the app:</strong> the person icon in the
            top-right corner → Delete account.
          </Bullet>
          <Bullet>
            <strong className="text-ink">On the website:</strong>{" "}
            <Link href="/profile" className="font-medium text-pitch hover:underline">
              your profile page
            </Link>{" "}
            → Delete account.
          </Bullet>
        </ul>
        <p className="mt-3">
          This removes your account, your predictions, your points, your league memberships,
          your push tokens and your sessions. Leagues you started stay open for their other
          members — a league belongs to everyone in it — but a league with no members left is
          deleted with you.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          If you are in the UK or the EU you have the right to access, correct, export or
          erase your personal data, and to object to processing. Deleting your account
          exercises the erasure right directly; for anything else, email{" "}
          <a href="mailto:privacy@scorersonline.uk" className="font-medium text-pitch hover:underline">
            privacy@scorersonline.uk
          </a>{" "}
          and we will respond within 30 days. You may also complain to the UK Information
          Commissioner&apos;s Office at ico.org.uk.
        </p>
      </Section>

      <Section title="Children">
        <p>
          Scorers is not directed at children under 13 and we do not knowingly collect data
          from them. If you believe a child has created an account, email us and we will
          delete it.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If this policy changes materially we will update the date at the top of this page
          and, where the change affects how we use data you have already given us, tell you
          by email before it takes effect.
        </p>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-bold text-ink">{title}</h2>
      <div className="space-y-1 text-sm leading-relaxed text-ink-mid">{children}</div>
    </section>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden="true" className="text-pitch">
        ·
      </span>
      <span>{children}</span>
    </li>
  )
}
