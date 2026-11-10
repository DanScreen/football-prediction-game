# Design System

The visual language is **"Quiet Product"** — a calm, editorial base with occasional
**broadcast-scoreboard moments** (deep-green panels, mono score digits) borrowed
from a darker concept. Chosen from a 3-concept pitch during the July 2026 redesign. The app is
branded **"Scorers"** in the UI chrome.

## Tokens

Design tokens live in `app/globals.css` under `@theme`. Use the tokens; don't hardcode
colours. The families:

| Group | Tokens | Use |
|-------|--------|-----|
| Surfaces | `ground`, `surface`, `chip` | Page bg, cards, subtle fills |
| Ink | `ink`, `ink-mid`, `ink-muted`, `ink-faint` | Text hierarchy |
| Lines | `line`, `line-soft`, `line-strong` | Borders/dividers |
| Accent (pitch) | `pitch`, `pitch-deep`, `pitch-tint`, `pitch-on` | Primary green accent |
| Deadline (clock) | `clock`, `clock-tint`, `clock-line`, `clock-on` | **Amber** — deadlines, **provisional** state, and the banker |
| Semantic | `good`, `bad`, `info` (each with `-tint` and `-line`) | Success / error / partial-credit |
| Scoreboard (board) | `board`, `board-panel`, `board-fore`, `board-muted`, `board-gold` | Deep-green scoreboard palette |

**There are no stock Tailwind colours in the app.** `bg-red-50`, `text-green-700` and
friends were swept out in favour of the `good`/`bad`/`info` families — that is what
makes the dark theme a single edit instead of a `dark:` variant on every element. If
you find yourself reaching for a numbered Tailwind colour, add or reuse a token instead.

- **`pitch-on`** is the text colour that sits *on* a pitch fill. Use it for button
  labels rather than `text-white`: in dark mode the accent inverts to a bright green
  and the label has to go near-black to stay legible.
- **`clock-on`** is the same idea for a solid amber fill (the active Banker button).
  The dark-mode amber is a *bright* `#e8a33d`, so white labels on it fail contrast
  badly — `text-white` on a filled `clock` background is always wrong.

- **Amber is for urgency, so countdowns earn it.** A countdown is neutral
  (`chip` / `ink-muted`) until the last 24 hours before kickoff.
- **Amber (`clock`) means "provisional / awaiting"** throughout — provisional scores,
  provisional points badges (`+X prov.`), "awaiting confirmation". Keep this consistent.
  It carries one extra job: the **banker** (★ ×2), which is amber because it shares the
  "this is weighted / watch this one" register rather than success or failure.
- **The board palette** is used for: leaderboard table header, host/admin nav bars,
  api-docs code blocks, and proposed-score chips. It is a deep pitch green — it was
  navy until 2026-08-16, which read as a borrowed element rather than part of the
  product. Gold on deep green is also the more football image.
- **`.score-digits`** class = Geist Mono bold, tabular — used for scores, countdowns,
  and countdowns. Reach for it wherever digits should line up.

## Dark theme

Three states, cycled by the header toggle: **System** (default, follows
`prefers-color-scheme`), **Light**, **Dark**. Only token *values* change; no component
carries a dark-mode branch.

The dark palette is defined once in `app/globals.css` as `--dark-*` variables. Applying
it is a mapping repeated for the two ways dark can win — `@media (prefers-color-scheme:
dark)` scoped to `:root:not([data-theme="light"])`, and `:root[data-theme="dark"]`. Only
the mapping is duplicated, never a colour value, so the two can't drift.

The choice is a non-`httpOnly` `theme` cookie (a device preference, not account data),
read server-side in the root layout (`lib/theme.server.ts`) and rendered into
`<html data-theme>` — so there's **no flash of the wrong theme** on first paint.
`"system"` deliberately sets no attribute, letting the media query apply.

Two tokens genuinely invert rather than just darken:

- **`pitch` brightens** (it has to read as text on a dark ground), so `pitch-on` flips
  to near-black for labels sitting on a pitch fill.
- **`pitch-deep` becomes lighter than `pitch`**, because a hover state should still
  move toward the light in a dark theme.

`color-scheme` is set so native UI — scrollbars, and crucially the date/time pickers in
the host fixture forms — themes itself too, and is pinned to the explicit choice rather
than the OS when one has been made.

When adding UI: use tokens and it is dark-ready for free. If you must hardcode a colour,
you own styling both themes.

## Logo

The mark is a **scoreline**: a pitch-green tile with a white "2", a gold dash, and a
white "1" — the thing every prediction actually is. Chosen from a three-concept pitch on
2026-08-17 (see [decisions.md](decisions.md)).

**The geometry lives in one place: [`lib/mark.ts`](../lib/mark.ts).** Two renderers read
from it — `app/components/Logo.tsx` (JSX, for the header) and
`scripts/generate-brand-assets.mjs` (SVG → PNG, for everything else). It is drawn as
stroked paths, never `<text>`: a font-dependent mark shifts between devices and vanishes
when rasterised into an icon.

Colours in the mark are **literal hexes, not tokens** — the only place in the app that's
true. The mark keeps its pitch green in both themes, the way an app icon does.

### Regenerating the assets

```bash
npm run brand:assets   # rewrites all eleven PNGs from lib/mark.ts
```

| Asset | Notes |
|-------|-------|
| `app/icon.png`, `app/apple-icon.png` | Favicon + touch icon. Apple's is squared (iOS masks it itself) |
| `app/opengraph-image.png` | Link previews. Its wordmark is set in a **system font at generation time** — regenerate on macOS and eyeball the result |
| `apps/mobile/…/icon.png` | iOS. Square and opaque; a rounded or transparent iOS icon is rejected |
| `android-icon-{foreground,background,monochrome}.png` | Three adaptive layers. Foreground and monochrome are inset to the safe area (`MARK_SAFE_AREA_SCALE`) because launchers crop to the device's shape; monochrome collapses the gold dash into one colour so the launcher can tint it |
| `splash-icon.png` | Padded, because Expo's `contain` scales the image to fill |
| `apps/mobile/…/mark.png` | The in-app `BrandMark` lockup — a PNG because the Expo app has no SVG renderer |
| `public/brand/email-logo.png` | Email header logo. It's in `public/` because email clients need a plain absolute URL |

Change the mark, run the script, commit the PNGs together. They're committed rather than
built on demand, so nothing regenerates them behind your back.

## Email

Emails use the light palette with one scoreboard moment: the deep-green `board` header
with the mark, a `board-gold` rule, and deep-green fixture cards. Amber still means
deadline. Emails can't use CSS variables, so `lib/emailLayout.ts` holds literal hex
copies of the tokens (`EMAIL_COLORS`). Update them if a light-theme token changes.
Layout is tables with inline styles only, for Outlook and Gmail. Details are in
[features.md](features.md#email-design-every-email-is-branded).

## Type

All-Inter (Nunito was dropped in the redesign). Headings get `text-wrap: balance`;
uppercase labels get letter-spacing.

## Team colour chips

The one place besides the logo where literal hexes are allowed: club colours are data,
not theme. `TeamChip` (web and app) draws a small two-tone circle from
`lib/teamColours.ts` with its own hairline border, so a white chip still reads on a white
card. Unknown teams get a neutral token chip.

## Homepage

`app/welcome/` is the scoreboard palette at full strength: a full-width `board` band,
`board-panel` for the demo card, `board-gold` for the accent and the primary button. Its
headline, team names and strip headings use **Big Shoulders** (self-hosted from `app/welcome/fonts/` with
`next/font/local`, on that page only); nothing else in the product does.

## Moments

Small celebration/interaction touches, used sparingly:
- **"Nailed it! ⚽"** pop on an exact (3-point) score.
- Animated point updates on the leaderboard (`AnimatedPoints`).
- Colour-coded left-border accents on prediction cards (green exact / blue partial /
  red wrong / amber provisional).

## Rules for UI work

- **Use tokens, never stock Tailwind colours** — that is what keeps both themes working.
- Wide content (tables) scrolls inside its own `overflow-x-auto` container; the page
  body never scrolls sideways.
- Keep the playful bits restrained — the base is quiet; the scoreboard moments are the
  accent, not the whole page.
