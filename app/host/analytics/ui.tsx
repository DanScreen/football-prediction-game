/**
 * Server-rendered building blocks for /host/analytics: stat tiles, charts and
 * badges. No client JavaScript — hover/focus tooltips are CSS, and every chart
 * ships a table view in a <details> so no value is tooltip-only.
 */
import Link from "next/link"
import type { LeagueHealth, Segment } from "@/lib/analytics/compute"
import { LEAGUE_HEALTH, SEGMENTS } from "@/lib/analytics/compute"

// ── Formatting ─────────────────────────────────────────────────────────────

export function pct(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—"
  return `${(value * 100).toFixed(digits)}%`
}

export function share(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return "—"
  return date.toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** `YYYY-MM-DD` → "23 Nov". */
export function formatDay(day: string | null, withYear = false): string {
  if (!day) return "—"
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  })
}

/** "today", "yesterday", "5 days ago" for a day key relative to `today`. */
export function daysAgo(day: string | null, today: string): string {
  if (!day) return "Never"
  const n = Math.round(
    (new Date(`${today}T00:00:00Z`).getTime() - new Date(`${day}T00:00:00Z`).getTime()) / 86_400_000,
  )
  if (n <= 0) return "Today"
  if (n === 1) return "Yesterday"
  if (n < 60) return `${n} days ago`
  return formatDay(day, true)
}

// ── Layout ─────────────────────────────────────────────────────────────────

export function Section({
  title,
  description,
  children,
  action,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>
          {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-surface p-4 shadow-card ${className}`}>{children}</div>
  )
}

export function StatTile({
  label,
  value,
  hint,
  href,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  href?: string
}) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </>
  )
  const cls = "block rounded-xl border border-line bg-surface px-4 py-3 shadow-card"
  return href ? (
    <Link className={`${cls} transition-colors hover:border-line-strong`} href={href}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/** A pill linking between the sub-pages of the analytics area. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="mb-4 inline-block text-sm text-ink-muted hover:text-ink" href={href}>
      ← {children}
    </Link>
  )
}

// ── Tooltip ────────────────────────────────────────────────────────────────

/** A CSS tooltip shown while its `group` parent is hovered or focused. */
function Tip({ children, align = "center" }: { children: React.ReactNode; align?: "center" | "left" | "right" }) {
  const pos =
    align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2"
  return (
    <span
      className={`pointer-events-none absolute bottom-full z-10 mb-1.5 hidden whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-surface shadow-card group-hover:block group-focus-visible:block ${pos}`}
      role="tooltip"
    >
      {children}
    </span>
  )
}

// ── Column chart ───────────────────────────────────────────────────────────

export type Column = {
  label: string
  /** The series in focus (drawn in `chart`). */
  value: number
  /** An optional second series stacked on top (drawn in `chart-soft`). */
  extra?: number
  tooltip: React.ReactNode
  /** Shown under the column; omit to leave blank (sparse axis labels). */
  axisLabel?: string
}

function niceMax(max: number): number {
  if (max <= 4) return Math.max(1, Math.ceil(max))
  const pow = 10 ** Math.floor(Math.log10(max))
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (max <= step * pow) return step * pow
  }
  return 10 * pow
}

/**
 * Vertical columns from one baseline, optionally two stacked series. Values are
 * counts; `max` fixes the scale (e.g. 100 for percentages expressed 0–100).
 */
export function ColumnChart({
  columns,
  legend,
  max,
  height = 160,
  format = (n: number) => String(n),
}: {
  columns: Column[]
  legend?: [string, string]
  max?: number
  height?: number
  format?: (n: number) => string
}) {
  const top = max ?? niceMax(Math.max(0, ...columns.map((c) => c.value + (c.extra ?? 0))))
  const ticks = [top, top / 2, 0]
  return (
    <div>
      {legend ? (
        <div className="mb-3 flex flex-wrap gap-4 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-chart" /> {legend[0]}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm bg-chart-soft" /> {legend[1]}
          </span>
        </div>
      ) : null}
      <div className="flex gap-2">
        <div
          aria-hidden
          className="flex flex-col justify-between text-right text-[10px] tabular-nums text-ink-faint"
          style={{ height }}
        >
          {ticks.map((t) => (
            <span className="-my-1.5 leading-3" key={t}>
              {format(Math.round(t * 10) / 10)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height }}>
            {ticks.map((t, i) => (
              <div
                className="absolute inset-x-0 border-t border-line-soft"
                key={t}
                style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
              />
            ))}
            <div className="absolute inset-0 flex items-end gap-[2px]">
              {columns.map((c, i) => {
                const main = top > 0 ? (c.value / top) * 100 : 0
                const extra = top > 0 ? ((c.extra ?? 0) / top) * 100 : 0
                const align = i < 3 ? "left" : i > columns.length - 4 ? "right" : "center"
                return (
                  <div
                    aria-label={typeof c.tooltip === "string" ? c.tooltip : c.label}
                    className="group relative flex h-full flex-1 cursor-default flex-col items-center justify-end outline-none hover:bg-chip/60 focus-visible:bg-chip"
                    key={c.label}
                    tabIndex={0}
                  >
                    <Tip align={align}>{c.tooltip}</Tip>
                    {extra > 0 ? (
                      <div
                        className={`w-full max-w-6 bg-chart-soft ${main > 0 ? "mb-[2px] rounded-t-[4px]" : "rounded-t-[4px]"}`}
                        style={{ height: `${extra}%` }}
                      />
                    ) : null}
                    {main > 0 ? (
                      <div
                        className={`w-full max-w-6 bg-chart ${extra > 0 ? "" : "rounded-t-[4px]"}`}
                        style={{ height: `${main}%` }}
                      />
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="mt-1 flex gap-[2px] border-t border-line pt-1 text-[10px] text-ink-faint">
            {columns.map((c) => (
              <span className="flex-1 overflow-visible whitespace-nowrap text-center" key={c.label}>
                {c.axisLabel ?? ""}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Horizontal bars ────────────────────────────────────────────────────────

export type BarRow = {
  label: React.ReactNode
  value: number
  /** Printed at the bar's tip. Defaults to the value. */
  display?: React.ReactNode
  href?: string
  hint?: React.ReactNode
}

/** Ranked horizontal bars in one colour: funnels, distributions, platform reach. */
export function BarList({ rows, max }: { rows: BarRow[]; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => {
        const width = top > 0 ? (r.value / top) * 100 : 0
        const label = r.href ? (
          <Link className="text-ink hover:text-pitch hover:underline" href={r.href}>
            {r.label}
          </Link>
        ) : (
          <span className="text-ink">{r.label}</span>
        )
        return (
          <li className="grid grid-cols-[minmax(6rem,min(40%,12rem))_1fr] items-center gap-3 text-sm" key={i}>
            <div className="min-w-0">
              <div className="truncate">{label}</div>
              {r.hint ? (
                <div className="truncate text-xs text-ink-faint" title={typeof r.hint === "string" ? r.hint : undefined}>
                  {r.hint}
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 flex-1">
                {width > 0 ? (
                  <div
                    className="h-full rounded-r-[4px] bg-chart"
                    style={{ width: `${Math.max(width, 0.75)}%` }}
                  />
                ) : null}
              </div>
              <span className="w-16 shrink-0 text-right text-xs tabular-nums text-ink-mid">
                {r.display ?? r.value}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ── Heat cells ─────────────────────────────────────────────────────────────

/** Background for a 0–1 intensity on the pitch ramp; null is an empty cell. */
export function heat(value: number | null): React.CSSProperties {
  if (value === null) return {}
  const mix = Math.round(8 + Math.min(1, Math.max(0, value)) * 92)
  return {
    backgroundColor: `color-mix(in srgb, var(--color-pitch) ${mix}%, var(--color-surface))`,
  }
}

/** Text that stays legible on a `heat()` cell. */
export function heatText(value: number | null): string {
  return value !== null && value >= 0.55 ? "text-pitch-on" : "text-ink"
}

export function HeatLegend({ low, high }: { low: string; high: string }) {
  return (
    <div aria-hidden className="mt-3 flex items-center gap-2 text-[10px] text-ink-faint">
      {low}
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <span className="inline-block size-3 rounded-sm border border-line-soft" key={v} style={heat(v)} />
      ))}
      {high}
    </div>
  )
}

/**
 * A GitHub-style calendar: one column per week (Mon–Sun), oldest left. `days`
 * maps day keys to an intensity label; absent days are blank.
 */
export function ActivityCalendar({
  weeks,
  active,
  firstTracked,
  today,
}: {
  /** Monday day keys, oldest first. */
  weeks: string[]
  active: Map<string, string>
  firstTracked: string
  today: string
}) {
  const addDays = (day: string, n: number) =>
    new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10)
  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-[3px]">
        <div aria-hidden className="mr-1 grid grid-rows-7 gap-[3px] text-[9px] leading-3 text-ink-faint">
          {["Mon", "", "Wed", "", "Fri", "", "Sun"].map((d, i) => (
            <span className="h-3" key={i}>
              {d}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div className="grid grid-rows-7 gap-[3px]" key={week}>
            {Array.from({ length: 7 }, (_, i) => {
              const day = addDays(week, i)
              const label = active.get(day)
              const future = day > today
              const untracked = day < firstTracked
              return (
                <span
                  aria-label={label ? `${formatDay(day, true)}: ${label}` : undefined}
                  className={`group relative size-3 rounded-[3px] ${
                    future ? "" : label ? "bg-chart" : untracked ? "bg-line-soft/50" : "bg-chip"
                  }`}
                  key={day}
                  tabIndex={label ? 0 : undefined}
                >
                  {label ? (
                    <Tip>
                      {formatDay(day, true)} · {label}
                    </Tip>
                  ) : null}
                </span>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Table view ─────────────────────────────────────────────────────────────

/** The accessible twin of a chart: the same numbers as a table, collapsed by default. */
export function TableView({
  headers,
  rows,
}: {
  headers: string[]
  rows: Array<Array<React.ReactNode>>
}) {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer text-ink-muted hover:text-ink">Show as table</summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-line-soft">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-chip text-ink-muted">
            <tr>
              {headers.map((h, i) => (
                <th className={`px-3 py-1.5 font-semibold ${i > 0 ? "text-right" : ""}`} key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr className="border-t border-line-soft" key={i}>
                {row.map((cell, j) => (
                  <td className={`px-3 py-1 text-ink-mid ${j > 0 ? "text-right tabular-nums" : ""}`} key={j}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

// ── Badges ─────────────────────────────────────────────────────────────────

const SEGMENT_STYLE: Record<Segment, string> = {
  core: "border-good-line bg-good-tint text-good",
  regular: "border-pitch/25 bg-pitch-tint text-pitch-deep",
  casual: "border-info-line bg-info-tint text-info",
  lapsed: "border-bad-line bg-bad-tint text-bad",
  never: "border-line-strong bg-chip text-ink-mid",
  new: "border-line bg-surface text-ink-muted",
  "no-league": "border-line bg-surface text-ink-faint",
}

export function SegmentBadge({ segment }: { segment: Segment }) {
  const meta = SEGMENTS.find((s) => s.key === segment)!
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${SEGMENT_STYLE[segment]}`}
      title={meta.description}
    >
      {meta.label}
    </span>
  )
}

const HEALTH_STYLE: Record<LeagueHealth, string> = {
  thriving: "border-good-line bg-good-tint text-good",
  active: "border-pitch/25 bg-pitch-tint text-pitch-deep",
  quiet: "border-info-line bg-info-tint text-info",
  dormant: "border-bad-line bg-bad-tint text-bad",
  solo: "border-line-strong bg-chip text-ink-mid",
  finished: "border-line bg-surface text-ink-faint",
}

export function HealthBadge({ health }: { health: LeagueHealth }) {
  const meta = LEAGUE_HEALTH[health]
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${HEALTH_STYLE[health]}`}
      title={meta.description}
    >
      {meta.label}
    </span>
  )
}

/** Four tiny columns: share of members who picked in each recent gameweek. */
export function MiniRounds({ values }: { values: Array<{ label: string; value: number | null }> }) {
  return (
    <span className="inline-flex h-5 items-end gap-[2px]" aria-label={values.map((v) => `${v.label}: ${pct(v.value)}`).join(", ")}>
      {values.map((v) => (
        <span
          className="group relative flex h-full w-2 items-end rounded-[2px] bg-chip"
          key={v.label}
        >
          {v.value ? (
            <span className="w-full rounded-[2px] bg-chart" style={{ height: `${Math.max(10, v.value * 100)}%` }} />
          ) : null}
          <Tip>
            {v.label}: {pct(v.value)}
          </Tip>
        </span>
      ))}
    </span>
  )
}

export const SURFACE_LABEL = { web: "Web", app: "App", api: "Bot API" } as const

export function Surfaces({ surfaces }: { surfaces: { web: boolean; app: boolean; api: boolean } }) {
  const on = (Object.keys(SURFACE_LABEL) as Array<keyof typeof SURFACE_LABEL>).filter((k) => surfaces[k])
  if (on.length === 0) return <span className="text-ink-faint">—</span>
  return (
    <span className="flex gap-1 whitespace-nowrap">
      {on.map((k) => (
        <span className="rounded border border-line bg-chip px-1.5 py-px text-[11px] text-ink-mid" key={k}>
          {SURFACE_LABEL[k]}
        </span>
      ))}
    </span>
  )
}
