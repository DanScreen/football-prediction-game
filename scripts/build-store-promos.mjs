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
 * The six panels, in listing order.
 *
 * `frameH` overrides the visible screen height — set it for a screen whose
 * content does not fill the default frame, so the phone closes inside the canvas
 * instead of bleeding off the bottom onto empty ground.
 */
const PANELS = [
  {
    name: "01-predict",
    screen: "01-predictions.png",
    headline: "Predict every scoreline",
    sub: "Set a banker to double one pick a week",
  },
  {
    name: "02-provisional",
    screen: "02-provisional.png",
    headline: "Watch it land\nin real time",
    sub: "Provisional points as results land",
  },
  {
    name: "03-results",
    screen: "03-results.png",
    headline: "See how close\nyou got",
    sub: "Exact, close, or nowhere near",
  },
  {
    name: "04-leaderboard",
    screen: "04-leaderboard.png",
    headline: "The table that\nsettles it",
    sub: "Points, form and every exact score",
  },
  {
    name: "05-leagues",
    screen: "05-leagues.png",
    headline: "Private leagues,\none invite link",
    sub: "No strangers, no discovery feed",
  },
  {
    name: "06-rules",
    screen: "06-rules.png",
    headline: "No luck about it",
    sub: "3 for an exact score, 1.5 for close",
    // The rules screen has less content than the others, so the default frame —
    // which runs off the bottom of the canvas — would end on a slab of empty
    // ground. A shorter frame that finishes inside the canvas ends on the last
    // line of copy and reads as a whole phone rather than a truncated one.
    frameH: 344,
  },
]

/**
 * The listing is a dark set — the app's dark theme is the better-looking one and
 * a single palette makes the six panels read as one sequence rather than six
 * unrelated ads. `light` is kept because the capture script still produces light
 * alternates; point a panel at one and set PANEL_THEME to "light" to use them.
 */
const PANEL_THEME = "dark"

const THEMES = {
  light: {
    bg: "linear-gradient(168deg, #eaf4ee 0%, #f7f8f7 55%, #eef1ee 100%)",
    ink: "#17201b",
    sub: "#5e6b63",
    accent: "#128749",
    bezel: "#17201b",
    bezelRim: "rgba(255,255,255,0.10)",
    glow: "rgba(18,135,73,0.16)",
  },
  dark: {
    bg: "linear-gradient(168deg, #0f4527 0%, #0e1411 58%, #061a0f 100%)",
    ink: "#eef7f1",
    sub: "#a9c9b6",
    accent: "#f2c74e",
    // Lighter than the app's own dark ground (#0e1411) on purpose: a bezel the
    // same colour as the screen it surrounds vanishes, and the panel stops
    // reading as a phone.
    bezel: "#1b2a22",
    bezelRim: "rgba(255,255,255,0.14)",
    glow: "rgba(242,199,78,0.14)",
  },
}

const dataUri = async (file) =>
  `data:image/png;base64,${(await readFile(path.join(SCREENS, file))).toString("base64")}`

function html({ panel, screenUri }) {
  const t = THEMES[PANEL_THEME]

  // The device bleeds off the bottom of the canvas rather than sitting fully
  // inside it. That buys a much larger screen — the app itself is the thing
  // being sold — and makes the crop at the bottom read as deliberate instead of
  // looking like a frame that was drawn too short.
  const frameW = 322
  const imgH = (frameW * 932) / 430
  const frameTop = 306
  // By default the device runs past the bottom edge of the canvas; a panel can
  // override `frameH` to close the frame inside it instead.
  const frameH = panel.frameH ?? 932 - frameTop + 90

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
    box-shadow:
      inset 0 0 0 1px ${t.bezelRim},
      0 30px 60px ${t.glow},
      0 12px 28px rgba(0,0,0,0.45);
  }
  .screen {
    width: ${frameW}px; height: ${frameH}px;
    border-radius: 39px; overflow: hidden; position: relative;
    background: #fff;
  }
  .screen img {
    position: absolute; top: 0; left: 0;
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
