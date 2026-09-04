/**
 * Capture App Store / Play Store screenshots from the *real* app.
 *
 * This Mac has Command Line Tools only, so there is no iOS Simulator to shoot.
 * Instead the Expo app runs under react-native-web — the same components, the
 * same tokens, the same API — in headless Chrome with the device metrics
 * overridden to an iPhone viewport at deviceScaleFactor 3. The output is a
 * native-resolution 1290×2796 PNG that is a genuine render of the app rather
 * than a mockup.
 *
 * Prerequisites (see docs/store-release.md for the full runbook):
 *
 *   docker compose up -d
 *   export DATABASE_URL="postgresql://postgres:localdev@localhost:55432/football_prediction_app"
 *   npx prisma migrate deploy && npx prisma db seed
 *   npx tsx scripts/seed-store-demo.ts
 *   npm run dev                                     # Next, :3000
 *   node scripts/serve-store-proxy.mjs              # one origin, :8090
 *   cd apps/mobile && EXPO_PUBLIC_API_URL=http://localhost:8090 npx expo start --web --port 8082
 *
 * Then:  node scripts/capture-store-shots.mjs
 *
 * Framed, captioned versions for the listing come from
 * `scripts/build-store-promos.mjs`, which reads what this writes.
 */
import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { withPage } from "./lib/chrome-shot.mjs"

const ORIGIN = process.env.STORE_SHOT_ORIGIN ?? "http://localhost:8090"
const API = process.env.STORE_SHOT_API ?? "http://localhost:3000"
const OUT = path.resolve("store-assets/screens")

/** Apple's 6.9" display class: 1290×2796 = 430×932 CSS at 3×. */
const DEVICE = { width: 430, height: 932, deviceScaleFactor: 3, mobile: true }

/**
 * Dark is the house look for the listing, so every panel screen is captured in
 * dark. The two light variants at the end are kept as alternates — swap one in
 * from `build-store-promos.mjs` if a panel ever needs the light theme back.
 */
const SHOTS = [
  { name: "01-predictions", route: "/", theme: "dark", settle: 2500 },
  // Kicked-off rounds sit below the open ones on Predictions, so scroll to reach
  // them: the amber provisional state is one of the best things the app has to
  // show. Settled rounds have their own tab, so that one is a plain route.
  { name: "02-provisional", route: "/", theme: "dark", settle: 2500, scrollToText: "KICKED OFF" },
  { name: "03-results", route: "/results", theme: "dark", settle: 2500 },
  { name: "04-leaderboard", route: "/leaderboard", theme: "dark", settle: 2500 },
  { name: "05-leagues", route: "/leagues", theme: "dark", settle: 2000 },
  { name: "06-rules", route: "/rules", theme: "dark", settle: 2000 },
  { name: "07-predictions-light", route: "/", theme: "light", settle: 2500 },
  { name: "08-leaderboard-light", route: "/leaderboard", theme: "light", settle: 2500 },
]

async function tokens() {
  const res = await fetch(`${API}/api/mobile/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: process.env.STORE_SHOT_EMAIL ?? "alice@football.test",
      password: process.env.STORE_SHOT_PASSWORD ?? "password123",
    }),
  })
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`)
  return res.json()
}

const { accessToken, refreshToken } = await tokens()

await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })

await withPage(
  {
    device: DEVICE,
    // Seed the session before the app's first render, so it never flashes the
    // sign-in screen. Expo web keeps tokens in localStorage — tokenStorage.ts.
    onNewDocument: `
      try {
        localStorage.setItem('scorers.accessToken', ${JSON.stringify(accessToken)});
        localStorage.setItem('scorers.refreshToken', ${JSON.stringify(refreshToken)});
      } catch (e) {}
    `,
  },
  async (page) => {
    for (const shot of SHOTS) {
      await page.setTheme(shot.theme)
      await page.goto(`${ORIGIN}${shot.route}`)
      // The dev bundle is large and each screen then fetches its own data, so
      // wait on a settle window rather than the load event.
      await page.wait(shot.settle)

      if (shot.scrollToText) {
        // react-native-web renders the ScrollView as a scrollable div, so find
        // the section heading and bring it to the top of the viewport.
        await page.send("Runtime.evaluate", {
          awaitPromise: true,
          expression: `(async () => {
            const el = [...document.querySelectorAll('div,span')]
              .find((n) => n.children.length === 0 &&
                           n.textContent.trim() === ${JSON.stringify(shot.scrollToText)});
            if (el) el.scrollIntoView({ block: 'start' });
            await new Promise((r) => setTimeout(r, 900));
          })()`,
        })
      }

      const file = path.join(OUT, `${shot.name}.png`)
      await writeFile(file, await page.shoot())
      console.log(`✓ ${path.relative(process.cwd(), file)}`)
    }
  },
)
