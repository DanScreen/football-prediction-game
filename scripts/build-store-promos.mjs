/**
 * Compose the App Store screenshot set: each real app capture from
 * `capture-store-shots.mjs`, framed in a device bezel on a branded background
 * with a headline above it.
 *
 * Apple accepts bare screenshots, but a listing reads far better when the six
 * panels tell a story in sequence, and a caption is the only chance to say what
 * a screen *means* before someone scrolls past it.
 *
 * The composition is an HTML page rendered at the exact 1290×2796 store size —
 * built at 430×932 CSS with deviceScaleFactor 3, the same trick the app
 * captures use, so the type stays sharp. Colours are the Quiet Product tokens
 * from `app/globals.css`, so the panels match the product they show.
 *
 *   node scripts/capture-store-shots.mjs   # first
 *   node scripts/build-store-promos.mjs
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { withPage } from "./lib/chrome-shot.mjs"

const SCREENS = path.resolve("store-assets/screens")
const OUT = path.resolve("store-assets/promo")

/** 1290×2796 at 3× — Apple's 6.9" iPhone display class. */
const DEVICE = { width: 430, height: 932, deviceScaleFactor: 3, mobile: false }

/**
 * The six panels, in listing order. `crop` is how far down the source capture
 * to slide it inside the bezel, as a fraction of its overscan — 0 keeps the top
 * of the screen, 1 pins the bottom.
 */
const PANELS = [
  {
    name: "01-predict",
    screen: "01-predictions.png",
    headline: "Predict every scoreline",
    sub: "Every fixture, right up to kickoff",
    theme: "light",
  },
  {
    name: "02-banker",
    screen: "01-predictions.png",
    headline: "Double down\nwith your Banker",
    sub: "One pick a week scores twice",
    theme: "light",
    crop: 0.16,
  },
  {
    name: "03-results",
    screen: "05-results.png",
    headline: "See how close\nyou got",
    sub: "Exact, close, or nowhere near",
    theme: "light",
  },
  {
    name: "04-leaderboard",
    screen: "04-leaderboard-dark.png",
    headline: "One table,\nall your leagues",
    sub: "Points, form and every exact score",
    theme: "dark",
  },
  {
    name: "05-leagues",
    screen: "06-leagues.png",
    headline: "Private leagues,\none invite link",
    sub: "No strangers, no discovery feed",
    theme: "light",
  },
  {
    name: "06-dark",
    screen: "02-predictions-dark.png",
    headline: "Looks right\nat night, too",
    sub: "Follows your system theme",
    theme: "dark",
  },
]

const THEMES = {
  light: {
    bg: "linear-gradient(168deg, #eaf4ee 0%, #f7f8f7 55%, #eef1ee 100%)",
    ink: "#17201b",
    sub: "#5e6b63",
    accent: "#128749",
    bezel: "#17201b",
    glow: "rgba(18,135,73,0.16)",
  },
  dark: {
    bg: "linear-gradient(168deg, #0f4527 0%, #0e1411 58%, #061a0f 100%)",
    ink: "#eef7f1",
    sub: "#a9c9b6",
    accent: "#f2c74e",
    bezel: "#04140b",
    glow: "rgba(242,199,78,0.14)",
  },
}

const dataUri = async (file) =>
  `data:image/png;base64,${(await readFile(path.join(SCREENS, file))).toString("base64")}`

function html({ panel, screenUri }) {
  const t = THEMES[panel.theme]

  // The device bleeds off the bottom of the canvas rather than sitting fully
  // inside it. That buys a much larger screen — the app itself is the thing
  // being sold — and makes the crop at the bottom read as deliberate instead of
  // looking like a frame that was drawn too short.
  const frameW = 322
  const imgH = (frameW * 932) / 430
  const frameTop = 306
  // Visible screen height, plus enough to run past the bottom edge.
  const frameH = 932 - frameTop + 90
  const overscan = Math.max(0, imgH - frameH)
  const offset = -(overscan * (panel.crop ?? 0))

  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 430px; height: 932px; overflow: hidden; }
  body {
    background: ${t.bg};
    font-family: -apple-system, "SF Pro Display", "Inter", system-ui, sans-serif;
    text-align: center;
  }
  header { padding: 74px 34px 0; }
  h1 {
    color: ${t.ink};
    font-size: 44px; line-height: 1.04; font-weight: 800;
    letter-spacing: -1.6px; white-space: pre-line;
  }
  p.sub {
    margin-top: 18px; color: ${t.sub};
    font-size: 18px; font-weight: 500; letter-spacing: -0.2px;
  }
  .rule {
    margin: 24px auto 0; width: 46px; height: 4px; border-radius: 2px;
    background: ${t.accent};
  }
  .bezel {
    position: absolute; top: ${frameTop}px; left: 50%;
    transform: translateX(-50%);
    width: ${frameW + 14}px; height: ${frameH + 14}px;
    background: ${t.bezel};
    border-radius: 46px; padding: 7px;
    box-shadow: 0 30px 60px ${t.glow}, 0 10px 24px rgba(0,0,0,0.22);
  }
  .screen {
    width: ${frameW}px; height: ${frameH}px;
    border-radius: 39px; overflow: hidden; position: relative;
    background: #fff;
  }
  .screen img {
    position: absolute; top: ${offset}px; left: 0;
    width: ${frameW}px; height: ${imgH}px; display: block;
  }
</style></head>
<body>
  <header>
    <h1>${panel.headline}</h1>
    <p class="sub">${panel.sub}</p>
    <div class="rule"></div>
  </header>
  <div class="bezel">
    <div class="screen"><img src="${screenUri}" alt=""></div>
  </div>
</body></html>`
}

await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })

await withPage({ device: DEVICE, port: 9334 }, async (page) => {
  for (const panel of PANELS) {
    const screenUri = await dataUri(panel.screen)
    await page.setContent(html({ panel, screenUri }))
    // Give the inlined PNG a beat to decode before the capture.
    await page.wait(700)
    const file = path.join(OUT, `${panel.name}.png`)
    await writeFile(file, await page.shoot())
    console.log(`✓ ${path.relative(process.cwd(), file)}`)
  }
})
