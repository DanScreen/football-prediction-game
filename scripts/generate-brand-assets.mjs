/**
 * Generates every raster brand asset from the single SVG source in `lib/mark.ts`.
 *
 *   npm run brand:assets
 *
 * Nothing here is generated at build time — the outputs are committed, and this
 * script exists so they can be regenerated together whenever the mark changes.
 * That matters because the assets live in two packages (web `app/`, Expo
 * `apps/mobile/assets/images/`) and previously drifted: the site had the scoreline
 * mark while the app still shipped the stock Expo icon.
 *
 * Caveat: the OG image sets its wordmark in a system sans (Helvetica/Arial), which
 * is resolved by the SVG rasteriser at generation time, not in the browser. Run
 * this on macOS, or check `app/opengraph-image.png` before committing it.
 */
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

import { MARK_COLORS, MARK_SAFE_AREA_SCALE, markSvg } from "../lib/mark.ts"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const MOBILE_IMAGES = "apps/mobile/assets/images"

/** Rasterise a mark SVG at `size` px square. High density so curves stay clean. */
const raster = (options, size) =>
  sharp(Buffer.from(markSvg(options)), { density: 600 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

/** Place a smaller rendering in the middle of a larger transparent canvas. */
async function inset(options, canvas, inner) {
  const glyph = await raster(options, inner)
  const offset = Math.round((canvas - inner) / 2)
  return sharp({
    create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: glyph, left: offset, top: offset }])
    .png()
    .toBuffer()
}

const written = []
async function emit(target, buffer) {
  const path = join(ROOT, target)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, buffer)
  written.push(`${relative(ROOT, path)}  ${(buffer.length / 1024).toFixed(1)} kB`)
}

/** A 1200×630 link preview: the mark, the name, and what the product does. */
async function openGraph() {
  const [w, h] = [1200, 630]
  const mark = await raster({}, 180)
  const type = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <g font-family="Helvetica Neue, Helvetica, Arial, sans-serif">
        <text x="340" y="322" font-size="88" font-weight="700" letter-spacing="-2"
              fill="#eef7f1">Scorers</text>
        <text x="344" y="382" font-size="32" font-weight="400"
              fill="#a9c9b6">Predict match scores and compete with friends</text>
      </g>
    </svg>`

  return sharp({ create: { width: w, height: h, channels: 4, background: MARK_COLORS.board } })
    .composite([
      { input: mark, left: 120, top: 225 },
      { input: Buffer.from(type), top: 0, left: 0 },
    ])
    .png()
    .toBuffer()
}

async function main() {
  // --- Web -----------------------------------------------------------------
  // Next.js serves app/icon.png as the favicon and app/apple-icon.png as the
  // touch icon. The touch icon is squared off because iOS applies its own mask.
  await emit("app/icon.png", await raster({}, 512))
  await emit("app/apple-icon.png", await raster({ radius: 0 }, 180))
  await emit("app/opengraph-image.png", await openGraph())
  // Email header (lib/emailLayout.ts) — shown at 44px, so 3x for retina. Served
  // from public/ because email clients need a plain absolute image URL.
  await emit("public/brand/email-logo.png", await raster({}, 132))

  // --- iOS -----------------------------------------------------------------
  // Square and fully opaque: a transparent or pre-rounded iOS icon is rejected.
  await emit(`${MOBILE_IMAGES}/icon.png`, await raster({ radius: 0 }, 1024))
  await emit(`${MOBILE_IMAGES}/favicon.png`, await raster({}, 64))

  // In-app lockup (the login/register BrandMark). A PNG rather than SVG because
  // the Expo app has no SVG renderer; 3x the largest on-screen size.
  await emit(`${MOBILE_IMAGES}/mark.png`, await raster({}, 144))

  // --- Android adaptive icon ------------------------------------------------
  // Three separate layers. Foreground and monochrome are transparent and pulled
  // in to the safe area, because the launcher crops them to the device's shape.
  await emit(
    `${MOBILE_IMAGES}/android-icon-foreground.png`,
    await raster({ background: null, scale: MARK_SAFE_AREA_SCALE }, 1024),
  )
  await emit(
    `${MOBILE_IMAGES}/android-icon-background.png`,
    await sharp({
      create: { width: 1024, height: 1024, channels: 4, background: MARK_COLORS.pitch },
    })
      .png()
      .toBuffer(),
  )
  // Monochrome (themed icons): one flat silhouette the launcher tints itself, so
  // the gold dash has to collapse into the same colour as the digits.
  await emit(
    `${MOBILE_IMAGES}/android-icon-monochrome.png`,
    await raster(
      {
        background: null,
        ink: MARK_COLORS.white,
        accent: MARK_COLORS.white,
        scale: MARK_SAFE_AREA_SCALE,
      },
      1024,
    ),
  )

  // --- Splash ---------------------------------------------------------------
  // resizeMode "contain" scales the whole image up, so the padding here is what
  // stops the mark filling the screen edge to edge.
  await emit(`${MOBILE_IMAGES}/splash-icon.png`, await inset({}, 1024, 460))

  console.log(`Generated ${written.length} assets from lib/mark.ts:`)
  for (const line of written) console.log(`  ${line}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
