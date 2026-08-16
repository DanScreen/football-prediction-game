import { permanentRedirect } from "next/navigation"

/**
 * My Predictions merged into the dashboard at `/` on 2026-08-16 — the two pages
 * both showed your picks and results, differing mainly in whether the fixture had
 * kicked off. Kept as a redirect so existing bookmarks and links still land.
 *
 * `actions.ts` in this folder is still the prediction server action; only the page
 * moved.
 */
export default function PredictionsRedirect() {
  permanentRedirect("/")
}
