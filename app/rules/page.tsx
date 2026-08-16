import Link from "next/link"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { RESULT_DELAY_MS } from "@/lib/resolution"
import { BANKER_MULTIPLIER } from "@/lib/scoring"

export const metadata = {
  title: "How it works",
  description: "The rules of Scorers: how predictions, deadlines, points and bonuses work.",
}

const SCORING = [
  { outcome: "Exact score", example: "You said 2–1, it finished 2–1", points: "3" },
  {
    outcome: "Right result and goal difference",
    example: "You said 2–1, it finished 3–2",
    points: "1.5",
  },
  { outcome: "Right result only", example: "You said 2–1, it finished 4–0", points: "1" },
  { outcome: "Wrong result", example: "You said 2–1, it finished 1–1", points: "0" },
]

/**
 * The rules of the game, in one place.
 *
 * Public: someone following an invite link should be able to read what they're
 * joining before creating an account. Signed in, it also reports the settings
 * that genuinely vary — Grand Slam is per league, so a fixed page would tell
 * some players something untrue about their own league.
 */
export default async function RulesPage() {
  const session = await auth()

  const memberships = session?.user?.id
    ? await prisma.leagueMembership.findMany({
        where: { userId: session.user.id },
        orderBy: { joinedAt: "asc" },
        select: {
          league: {
            select: {
              id: true,
              name: true,
              grandSlamEnabled: true,
              grandSlamPoints: true,
              competition: { select: { name: true } },
            },
          },
        },
      })
    : []

  const resultDelay = formatDelay(RESULT_DELAY_MS)

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold text-ink">How it works</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Predict the scoreline of every fixture, score points for how close you get, and see
          where you finish against your friends.
        </p>
      </header>

      <Section title="Making a prediction" emoji="⚽">
        <ul className="space-y-2">
          <Bullet>
            Enter a scoreline for each fixture on the{" "}
            <Link href="/" className="font-medium text-pitch hover:underline">
              Predictions
            </Link>{" "}
            page. Fixtures are grouped by gameweek, with the nearest one open.
          </Bullet>
          <Bullet>
            <strong className="text-ink">The deadline is each fixture&apos;s own kickoff</strong>{" "}
            — not the start of the gameweek. You can change a pick as many times as you like until
            then; after kickoff it locks and everyone&apos;s picks are revealed.
          </Bullet>
          <Bullet>
            Miss a deadline and you simply score nothing for that match. There&apos;s no penalty
            for sitting one out.
          </Bullet>
          <Bullet>
            <strong className="text-ink">One pick counts in every league you&apos;re in</strong>{" "}
            on that competition. You don&apos;t predict the same match twice for two leagues.
          </Bullet>
        </ul>
      </Section>

      <Section title="Points" emoji="🎯">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="py-2 pr-4 font-semibold">Outcome</th>
                <th className="py-2 pr-4 font-semibold">Example</th>
                <th className="py-2 text-right font-semibold">Points</th>
              </tr>
            </thead>
            <tbody>
              {SCORING.map((row) => (
                <tr key={row.outcome} className="border-b border-line-soft last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-ink">{row.outcome}</td>
                  <td className="py-2.5 pr-4 text-ink-muted">{row.example}</td>
                  <td className="score-digits py-2.5 text-right text-base text-ink">
                    {row.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-faint">
          &ldquo;Result&rdquo; means home win, draw or away win. Getting the goal difference right
          as well earns the half point — so 2–1 when it finished 3–2 beats 2–1 when it finished
          4–0.
        </p>
      </Section>

      <Section title="Banker — double points" emoji="★">
        <ul className="space-y-2">
          <Bullet>
            Pick <strong className="text-ink">one fixture per gameweek</strong>{" "}
            as your banker and its points are multiplied by {BANKER_MULTIPLIER}. An exact score
            becomes {3 * BANKER_MULTIPLIER} points.
          </Bullet>
          <Bullet>
            Save a prediction on the fixture first, then press <em>Banker</em>. Choosing another
            fixture in the same gameweek moves it — you never have to clear the old one.
          </Bullet>
          <Bullet>
            <strong className="text-ink">It can only help you.</strong>{" "}
            The lowest score is 0, and doubling nothing is still nothing — so the skill is picking
            the match you&apos;re most confident about, not deciding how much to risk.
          </Bullet>
          <Bullet>
            Once your banker&apos;s fixture kicks off it&apos;s locked, and you can&apos;t move it
            onto a later match in the same gameweek. Otherwise you could watch one game go badly
            and shift the double somewhere else.
          </Bullet>
          <Bullet>
            If you play in more than one competition, you get a banker in each.
          </Bullet>
        </ul>
      </Section>

      <Section title="Grand Slam bonus" emoji="🏆">
        <p>
          Get the <em>result</em>{" "}right in every fixture of a gameweek — not the exact scores, just
          who won or drew — and you earn a bonus. It&apos;s optional and set by each league&apos;s
          commissioner, so it can differ between your leagues.
        </p>
        {memberships.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {memberships.map(({ league }) => (
              <li
                key={league.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {league.name}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {league.competition.name}
                  </span>
                </span>
                {league.grandSlamEnabled ? (
                  <span className="shrink-0 rounded-full border border-clock-line bg-clock-tint px-2.5 py-0.5 text-xs font-semibold text-clock">
                    Grand Slam on · +{league.grandSlamPoints} pts
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full border border-line bg-chip px-2.5 py-0.5 text-xs font-medium text-ink-muted">
                    Grand Slam off
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-ink-faint">
            Sign in to see whether it&apos;s switched on in your leagues, and for how many points.
          </p>
        )}
        <p className="mt-3 text-xs text-ink-faint">
          Awarded once every fixture in the gameweek has a confirmed result. Bankering a match
          makes no difference to whether you qualify.
        </p>
      </Section>

      <Section title="Results and provisional points" emoji="⏱">
        <ul className="space-y-2">
          <Bullet>
            Final scores are fetched automatically after full time. While they&apos;re waiting to
            be checked, your projected points show{" "}
            <span className="rounded-md border border-clock-line bg-clock-tint px-1.5 py-0.5 text-xs font-semibold text-clock">
              in amber
            </span>{" "}
            and are marked <em>provisional</em>.
          </Bullet>
          <Bullet>
            <strong className="text-ink">Provisional points never move the table.</strong>{" "}
            Standings only count results a site host has confirmed — a quick human check keeps
            postponements and mismatched team names off the leaderboard.
          </Bullet>
          <Bullet>
            If a result hasn&apos;t appeared {resultDelay} after kickoff, any member can press{" "}
            <em>Request result</em>{" "}on the fixture to trigger the lookup.
          </Bullet>
        </ul>
      </Section>

      <Section title="The leaderboard" emoji="📊">
        <ul className="space-y-2">
          <Bullet>
            Ranked by confirmed points, highest first. Players level on points{" "}
            <strong className="text-ink">share a rank</strong>{" "}
            — there&apos;s no tiebreak.
          </Bullet>
          <Bullet>
            Each row also shows your exact-score count, Grand Slam badges, and a form strip for
            the last five gameweeks.
          </Bullet>
          <Bullet>
            You see every league you&apos;re in, one after another — nothing to switch between.
          </Bullet>
        </ul>
      </Section>

      <Section title="Leagues" emoji="👥">
        <ul className="space-y-2">
          <Bullet>
            Anyone can create an account. <strong className="text-ink">Leagues are private</strong>{" "}
            — you need an invite link or a 6-character invite code to join one.
          </Bullet>
          <Bullet>
            A league follows one competition. Join as many leagues as you like; your picks carry
            across all of them.
          </Bullet>
          <Bullet>
            Whoever creates a league is its commissioner, and can rename it, set the Grand Slam
            bonus and share invites.
          </Bullet>
        </ul>
      </Section>

      <Section title="Bots are welcome" emoji="🤖">
        <p>
          There&apos;s a public API for submitting picks programmatically, on exactly the same
          rules and deadlines as everyone else — banker included.{" "}
          {session ? (
            <Link href="/api-docs" className="font-medium text-pitch hover:underline">
              Read the API docs →
            </Link>
          ) : (
            <>Sign in and check the API docs for details.</>
          )}
        </p>
      </Section>

      {!session && (
        <div className="rounded-xl border border-line bg-surface px-5 py-4 text-center shadow-card">
          <p className="text-sm text-ink-muted">Got an invite? That&apos;s everything you need.</p>
          <Link
            href="/register"
            className="mt-3 inline-block rounded-xl bg-pitch px-5 py-2.5 text-sm font-semibold text-pitch-on shadow-card transition-colors hover:bg-pitch-deep"
          >
            Create an account
          </Link>
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  emoji,
  children,
}: {
  title: string
  emoji: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-ink">
        <span aria-hidden="true">{emoji}</span>
        {title}
      </h2>
      <div className="text-sm leading-relaxed text-ink-mid">{children}</div>
    </section>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-pitch/50" />
      <span>{children}</span>
    </li>
  )
}

/** "1h 45m" from a duration in ms — keeps the copy honest if RESULT_DELAY_MS moves. */
function formatDelay(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
}
