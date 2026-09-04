import Link from "next/link"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export const metadata = { title: "API Docs" }

const CURL_FIXTURES = `curl -H "Authorization: Bearer YOUR_API_KEY" \\
  "$BASE_URL/api/v1/fixtures?status=open"`

const CURL_SUBMIT = `curl -X POST \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"fixtureId": "FIXTURE_ID", "homeScore": 2, "awayScore": 1}' \\
  "$BASE_URL/api/v1/predictions"`

const PYTHON_BOT = `import requests

BASE_URL = "https://your-app-url"  # no trailing slash
HEADERS = {"Authorization": "Bearer YOUR_API_KEY"}

# 1. Fetch fixtures still open for predictions
fixtures = requests.get(
    f"{BASE_URL}/api/v1/fixtures", params={"status": "open"}, headers=HEADERS
).json()

# 2. Predict 2-1 to the home side in every match (your model goes here!)
for f in fixtures:
    r = requests.post(
        f"{BASE_URL}/api/v1/predictions",
        json={"fixtureId": f["id"], "homeScore": 2, "awayScore": 1},
        headers=HEADERS,
    )
    print(f["homeTeam"], "vs", f["awayTeam"], "->", r.status_code)

# 3. Check the standings
print(requests.get(f"{BASE_URL}/api/v1/leaderboard", headers=HEADERS).json())`

export default async function ApiDocsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink mb-2">🤖 Bot API</h1>
        <p className="text-sm text-ink-muted">
          Submit predictions programmatically — point your model at the same league as everyone
          else. All endpoints live under <code className="bg-chip px-1.5 py-0.5 rounded text-xs">/api/v1/</code>{" "}
          and authenticate with the API key from your{" "}
          <Link href="/profile" className="text-pitch font-medium hover:underline">
            profile page
          </Link>
          :
        </p>
        <pre className="mt-3 bg-board text-board-fore rounded-xl p-4 text-xs overflow-x-auto">
          Authorization: Bearer YOUR_API_KEY
        </pre>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-ink">Endpoints</h2>

        <Endpoint method="GET" path="/api/v1/fixtures?status=open">
          Fixtures still open for predictions (kickoff in the future), oldest first. Omit{" "}
          <code className="bg-chip px-1 rounded">status=open</code> to include locked and
          completed fixtures. Optional <code className="bg-chip px-1 rounded">?leagueId=</code>{" "}
          scopes to a league you belong to (defaults to your first league) — fixtures come from
          that league&apos;s competition. Completed fixtures carry{" "}
          <code className="bg-chip px-1 rounded">actualHomeScore/actualAwayScore</code>. Results
          are confirmed automatically once football-data.org has them.
        </Endpoint>

        <Endpoint method="POST" path="/api/v1/predictions">
          Create or update your prediction. Body:{" "}
          <code className="bg-chip px-1 rounded">
            {"{ fixtureId, homeScore, awayScore, isBanker? }"}
          </code>{" "}
          — scores are non-negative integers. Rejected with 422 once the fixture has kicked off.
          Fixtures are shared across every league on the competition, so one pick counts everywhere
          you play. <code className="bg-chip px-1 rounded">isBanker</code> is optional: pass{" "}
          <code className="bg-chip px-1 rounded">true</code> to make this your double-points pick
          for the gameweek (one per round — it moves off your previous choice), or omit it to leave
          your banker alone.
        </Endpoint>

        <Endpoint method="GET" path="/api/v1/predictions">
          Your own predictions with fixture details and actual scores.{" "}
          <code className="bg-chip px-1 rounded">isBanker</code> flags your double-points pick for
          that round; the doubling is already included in the points below. Confirmed points are
          in{" "}
          <code className="bg-chip px-1 rounded">pointsAwarded</code> once the fixture is
          completed. Legacy <code className="bg-chip px-1 rounded">provisional*</code> fields
          remain for compatibility but are always null under auto-confirm.
        </Endpoint>

        <Endpoint method="GET" path="/api/v1/leaderboard">
          Current standings ranked by confirmed points.{" "}
          <code className="bg-chip px-1 rounded">totalPoints</code> is confirmed points (including
          streak bonuses). Legacy <code className="bg-chip px-1 rounded">provisionalPoints</code>{" "}
          and <code className="bg-chip px-1 rounded">projectedPoints</code> remain for bot
          compatibility but match confirmed totals under auto-confirm.
        </Endpoint>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink mb-3">Quick start — curl</h2>
        <pre className="bg-board text-board-fore rounded-xl p-4 text-xs overflow-x-auto mb-3">
          {CURL_FIXTURES}
        </pre>
        <pre className="bg-board text-board-fore rounded-xl p-4 text-xs overflow-x-auto">
          {CURL_SUBMIT}
        </pre>
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink mb-3">A minimal Python bot</h2>
        <pre className="bg-board text-board-fore rounded-xl p-4 text-xs overflow-x-auto">
          {PYTHON_BOT}
        </pre>
      </section>

      <section className="bg-clock-tint border border-clock-line rounded-xl p-4">
        <h2 className="text-sm font-semibold text-clock mb-1">Notes</h2>
        <ul className="text-xs text-clock space-y-1 list-disc pl-4">
          <li>Predictions lock at kickoff — submit (or update) any time before then.</li>
          <li>One prediction per fixture; POSTing again overwrites your previous pick.</li>
          <li>Keep your key secret — anyone holding it can submit picks as you.</li>
        </ul>
      </section>
    </div>
  )
}

function Endpoint({
  method,
  path,
  children,
}: {
  method: "GET" | "POST"
  path: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface border border-line rounded-xl p-4">
      <p className="font-mono text-sm mb-1.5">
        <span
          className={`inline-block w-14 text-center text-xs font-bold rounded px-1.5 py-0.5 mr-2 ${
            method === "GET" ? "bg-info-tint text-info" : "bg-good-tint text-good"
          }`}
        >
          {method}
        </span>
        {path}
      </p>
      <p className="text-xs text-ink-muted leading-relaxed">{children}</p>
    </div>
  )
}
