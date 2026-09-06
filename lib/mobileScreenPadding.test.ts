import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * `screenPadding.pad` sets `flex: 1`, which pins a ScrollView's content
 * container to the viewport height so it can never grow — the list stops
 * scrolling and everything past the first screenful is unreachable. That style
 * is for non-scrolling layouts; `scrollContent` (`flexGrow: 1`) is the one that
 * fills a short screen *and* grows past a long one.
 *
 * The warning comment on the style did not stop this shipping on the Results
 * tab (2026-09-05, reported and fixed 2026-09-06), so it is a test now.
 *
 * It scans source rather than rendering: the root vitest runs in a node
 * environment with no React Native runtime. It lives here, not in
 * `apps/mobile`, because the mobile tsconfig has no Node types and typechecks
 * everything under that directory — a filesystem test there breaks CI's mobile
 * typecheck. The root tsconfig excludes `apps/`, so this is the only place it
 * both compiles and runs.
 */
const MOBILE = join(__dirname, "..", "apps", "mobile")

function tsxFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full))
    else if (entry.endsWith(".tsx")) out.push(full)
  }
  return out
}

describe("mobile screenPadding", () => {
  it("is never used as a scroll container's contentContainerStyle", () => {
    const offenders = [...tsxFiles(join(MOBILE, "app")), ...tsxFiles(join(MOBILE, "components"))]
      .filter((f) => /contentContainerStyle=\{screenPadding\.pad\}/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(MOBILE.length + 1))

    expect(offenders).toEqual([])
  })

  it("finds the screens it is meant to be guarding", () => {
    // Guards the guard: if the scan silently matched nothing — a moved
    // directory, a renamed style — the test above would pass on an empty set.
    const scrolling = [...tsxFiles(join(MOBILE, "app"))].filter((f) =>
      /contentContainerStyle=\{screenPadding\.scrollContent\}/.test(readFileSync(f, "utf8")),
    )
    expect(scrolling.length).toBeGreaterThanOrEqual(7)
  })

  it("keeps flexGrow, not flex, on scrollContent", () => {
    const ui = readFileSync(join(MOBILE, "components/ui.tsx"), "utf8")
    const block = ui.slice(ui.indexOf("scrollContent:"))
    const body = block.slice(0, block.indexOf("}"))
    expect(body).toMatch(/flexGrow:\s*1/)
    // If this ever becomes flex:1, every scrolling screen breaks at once.
    expect(body).not.toMatch(/(^|[^A-Za-z])flex:\s*1/)
  })
})
