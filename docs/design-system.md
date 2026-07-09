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
| Accent (pitch) | `pitch`, `pitch-deep`, `pitch-tint` (#128749) | Primary green accent |
| Deadline (clock) | `clock`, `clock-tint` | **Amber** — deadlines **and provisional** state |
| Scoreboard (board) | `board`, `board-panel`, `board-fore`, `board-muted`, `board-gold`, `board-cyan` | Navy scoreboard palette |

- **Amber (`clock`) means "provisional / awaiting"** throughout — provisional scores,
  provisional points badges (`+X prov.`), "awaiting confirmation". Keep this consistent.
- **Board navy** is used for: leaderboard table header, host/admin nav bars, api-docs
  code blocks, and proposed-score chips.
- **`.score-digits`** class = Geist Mono bold, tabular — used for scores, countdowns,
  and stat tiles. Reach for it wherever digits should line up.

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

- Style **both** light and dark where the design isn't deliberately single-theme.
- Wide content (tables) scrolls inside its own `overflow-x-auto` container; the page
  body never scrolls sideways.
- Keep the playful bits restrained — the base is quiet; the scoreboard moments are the
  accent, not the whole page.
