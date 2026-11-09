import type { Metadata } from "next"
import Link from "next/link"
import { Big_Shoulders } from "next/font/google"
import InviteCodeForm from "./InviteCodeForm"
import ScoreDemo from "./ScoreDemo"

// The headline face. This Next version ships the family as `Big_Shoulders`
// (its display optical size is on the opsz axis, which browsers set from the
// font size automatically), so there is no separate `Big_Shoulders_Display`.
const display = Big_Shoulders({
  subsets: ["latin"],
  weight: ["700", "900"],
  display: "swap",
})

export const metadata: Metadata = {
  title: { absolute: "Scorers — predict the score, beat your mates" },
  description:
    "Predict every scoreline of the gameweek with your friends, and see where your points put you in the league table.",
}

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-board-gold"

export default function WelcomePage() {
  return (
    <div className="bg-board text-board-fore">
      <div className="relative overflow-hidden">
        {/* Pitch markings: halfway line and centre circle, behind the content. */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-[-10%] bottom-[-10%] left-1/2 w-0 border-l-2 border-board-fore/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-board-fore/10"
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-9 px-4 pt-10 pb-10 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-9">
          <div className="min-w-0">
            <h1
              className={`${display.className} text-[clamp(2.75rem,9vw,6.8rem)] leading-[0.86] font-black tracking-[0.005em] uppercase`}
            >
              Call the <span className="text-board-gold">score.</span>{" "}
              <span className="block">Beat your mates.</span>
            </h1>

            <p className="mt-4 max-w-[38ch] text-base text-board-muted">
              Predict every scoreline of the gameweek. Fixtures and results fill themselves in. The
              table settles the argument.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link
                href="/register"
                className={`inline-flex min-h-11 items-center rounded-[10px] bg-board-gold px-5 text-[0.95rem] font-bold text-board ${focusRing}`}
              >
                Start a league
              </Link>
              <Link
                href="/login"
                className={`inline-flex min-h-11 items-center rounded-[10px] px-2 text-[0.95rem] font-bold text-board-fore underline-offset-4 hover:underline ${focusRing}`}
              >
                Sign in
              </Link>
            </div>

            <div className="mt-6 max-w-sm">
              <p className="text-sm text-board-muted">Got an invite code from a friend?</p>
              <div className="mt-2">
                <InviteCodeForm />
              </div>
            </div>

            <p className="mt-6 text-sm text-board-muted">Free on the web and the iPhone app.</p>
            <div className="mt-1 flex flex-wrap gap-x-4 text-sm text-board-muted">
              <Link href="/rules" className={`inline-flex min-h-10 items-center underline underline-offset-4 ${focusRing}`}>
                How it works
              </Link>
              <Link href="/privacy" className={`inline-flex min-h-10 items-center underline underline-offset-4 ${focusRing}`}>
                Privacy
              </Link>
              <Link href="/support" className={`inline-flex min-h-10 items-center underline underline-offset-4 ${focusRing}`}>
                Support
              </Link>
            </div>
          </div>

          <ScoreDemo displayClassName={display.className} />
        </div>

        <div className="relative border-t border-board-fore/10 bg-board">
          <div className="mx-auto grid max-w-6xl grid-cols-1 sm:grid-cols-3">
            <div className="border-b border-board-fore/10 px-4 py-5 sm:border-r sm:border-b-0 sm:px-7 sm:last:border-r-0">
              <h2 className={`${display.className} text-2xl font-bold tracking-[0.02em] uppercase`}>
                Nothing to type in
              </h2>
              <p className="mt-1 text-sm text-board-muted">
                Fixtures arrive and results confirm on their own. Nobody runs a spreadsheet.
              </p>
            </div>
            <div className="border-b border-board-fore/10 px-4 py-5 sm:border-r sm:border-b-0 sm:px-7 sm:last:border-r-0">
              <h2 className={`${display.className} text-2xl font-bold tracking-[0.02em] uppercase`}>
                One banker a week
              </h2>
              <p className="mt-1 text-sm text-board-muted">
                Pick the match you&apos;re surest of. It scores double.
              </p>
            </div>
            <div className="px-4 py-5 sm:px-7">
              <h2 className={`${display.className} text-2xl font-bold tracking-[0.02em] uppercase`}>
                Bots welcome
              </h2>
              <p className="mt-1 text-sm text-board-muted">
                Point your model at the API and put it in the same table as your friends.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
