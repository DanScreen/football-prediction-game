# Design System

The visual language is **"Quiet Product"** — a calm, editorial base with occasional
**broadcast-scoreboard moments** (navy panels, mono score digits) borrowed from a
darker concept. Chosen from a 3-concept pitch during the July 2026 redesign. The app is
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
| Deadline (clock) | `clock`, `clock-tint`, `clock-line` | **Amber** — deadlines **and provisional** state |
| Semantic | `good`, `bad`, `info` (each with `-tint` and `-line`) | Success / error / partial-credit |
| Scoreboard (board) | `board`, `board-panel`, `board-fore`, `board-muted`, `board-gold`, `board-cyan` | Navy scoreboard palette |

**There are no stock Tailwind colours in the app.** `bg-red-50`, `text-green-700` and
friends were swept out in favour of the `good`/`bad`/`info` families — that is what
makes the dark theme a single edit instead of a `dark:` variant on every element. If
you find yourself reaching for a numbered Tailwind colour, add or reuse a token instead.

- **`pitch-on`** is the text colour that sits *on* a pitch fill. Use it for button
  labels rather than `text-white`: in dark mode the accent inverts to a bright green
  and the label has to go near-black to stay legible.

- **Amber (`clock`) means "provisional / awaiting"** throughout — provisional scores,
  provisional points badges (`+X prov.`), "awaiting confirmation". Keep this consistent.
- **Board navy** is used for: leaderboard table header, host/admin nav bars, api-docs
  code blocks, and proposed-score chips.
- **`.score-digits`** class = Geist Mono bold, tabular — used for scores, countdowns,
  and stat tiles. Reach for it wherever digits should line up.

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

## Type

All-Inter (Nunito was dropped in the redesign). Headings get `text-wrap: balance`;
uppercase labels get letter-spacing.

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
