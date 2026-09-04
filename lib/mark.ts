/**
 * The Scorers mark — the one place its geometry is defined.
 *
 * The mark is a scoreline: white "2", gold dash, white "1" on a pitch-green tile.
 * It is drawn as stroked geometry rather than `<text>` on purpose — a text-based
 * mark depends on a font being loaded, so it shifted between devices and vanished
 * entirely when rasterised into an app icon.
 *
 * Both renderers read from here: `app/components/Logo.tsx` draws it as JSX, and
 * `scripts/generate-brand-assets.mjs` builds every PNG (favicon, iOS icon, Android
 * adaptive layers, splash, OG image) via `markSvg()`. Change the geometry here and
 * run `npm run brand:assets` to bring the raster assets back in step.
 */

/** Literal hexes, not tokens: these are baked into PNGs where CSS can't reach. */
export const MARK_COLORS = {
  pitch: "#128749",
  gold: "#f2c74e",
  white: "#ffffff",
  board: "#0f4527",
} as const

/** Everything below is expressed on a 64×64 grid. */
export const MARK_VIEWBOX = 64

/** Default tile corner radius. Use 0 where the OS applies its own icon mask. */
export const MARK_RADIUS = 14

export const MARK_STROKE_WIDTH = 5

/** The digits, as stroked open paths: the "2", then the "1" as stem-with-flag + foot. */
export const MARK_DIGIT_PATHS = [
  "M9.4,27.2 A7,7 0 1,1 21.6,31.5 L9.6,44.5 H23.2",
  "M43.5,26 L48.5,21.5 V44.5",
  "M42.5,44.5 H54.5",
] as const

/** The gold separator, centred between the digits. */
export const MARK_DASH = { x: 28.8, y: 30.4, width: 8.4, height: 5.2, rx: 2.6 } as const

/**
 * Android adaptive icons only guarantee the central ~66% of the canvas is visible —
 * the launcher crops the rest to whatever shape the device uses. Shrinking the glyph
 * by this much keeps it clear of that crop.
 */
export const MARK_SAFE_AREA_SCALE = 0.72

export type MarkOptions = {
  /** Corner radius in grid units; ignored when `background` is null. */
  radius?: number
  /** Tile fill, or null to draw the glyph on transparency. */
  background?: string | null
  /** Colour of the digits. */
  ink?: string
  /** Colour of the dash. Pass the same value as `ink` for a one-colour mark. */
  accent?: string
  /** Shrink the glyph about the tile centre. */
  scale?: number
}

/** Builds a standalone SVG document for the mark. Used by the asset generator. */
export function markSvg({
  radius = MARK_RADIUS,
  background = MARK_COLORS.pitch,
  ink = MARK_COLORS.white,
  accent = MARK_COLORS.gold,
  scale = 1,
}: MarkOptions = {}): string {
  const v = MARK_VIEWBOX
  const c = v / 2
  const tile =
    background === null
      ? ""
      : `<rect width="${v}" height="${v}" rx="${radius}" fill="${background}"/>`
  const transform =
    scale === 1 ? "" : ` transform="translate(${c},${c}) scale(${scale}) translate(-${c},-${c})"`
  const digits = MARK_DIGIT_PATHS.map((d) => `<path d="${d}"/>`).join("")
  const { x, y, width, height, rx } = MARK_DASH

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${v} ${v}" width="${v}" height="${v}">`,
    tile,
    `<g${transform}>`,
    `<g fill="none" stroke="${ink}" stroke-width="${MARK_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">${digits}</g>`,
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="${accent}"/>`,
    `</g>`,
    `</svg>`,
  ].join("")
}
