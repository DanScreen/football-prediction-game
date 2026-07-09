# Scorers — Documentation Wiki

This folder is the **single source of truth** for the Scorers football-prediction
app. It is written to be read by both humans and AI agents. If you are an agent
picking up this repo with no prior context, **start here** — reading this folder
in order will give you the project's current state, its goals, and how to work in
it, without needing to reverse-engineer the codebase first.

---

## 🤖 Agent operating protocol

**Read this before doing anything else.** These rules keep the wiki trustworthy so
the next agent can trust it too.

### 1. Orient yourself first (read in this order)

| # | Doc | What you get |
|---|-----|--------------|
| 1 | [product.md](product.md) | What Scorers is, who it's for, the product goals |
| 2 | [state.md](state.md) | **Current state** — what's built, what's live, deploy status |
| 3 | [roadmap.md](roadmap.md) | **Next steps** — planned work, known gaps, future ideas |
| 4 | [architecture.md](architecture.md) | Tech stack, how the pieces fit, the code map |

That's the minimum to understand the project. Load the reference docs below only
when a task touches them.

### 2. Reference docs (read on demand)

| Doc | When to read it |
|-----|-----------------|
| [data-model.md](data-model.md) | Touching Prisma schema, queries, or migrations |
| [features.md](features.md) | Changing any page, scoring, results, reminders, or auth flows |
| [api.md](api.md) | Changing the public `/api/v1` bot API |
| [development.md](development.md) | Setting up locally, running tests, writing migrations, gotchas |
| [deployment.md](deployment.md) | Anything about infra, Terraform, secrets, CI/CD, the domain |
| [design-system.md](design-system.md) | Any visual/UI work |
| [decisions.md](decisions.md) | Understanding *why* something is the way it is (decision log) |
| [changelog.md](changelog.md) | The history of what shipped, phase by phase |

### 3. The golden rule: **update the docs with every change**

Whenever you change the codebase, **update the docs that the change affects, in the
same session**, so this wiki never drifts from reality. This is not optional — a
stale wiki is worse than no wiki. Concretely:

- **New feature or behaviour change** → update [features.md](features.md) and, if it
  shifts what's live, [state.md](state.md).
- **Schema change** → update [data-model.md](data-model.md) (and note the migration).
- **New/changed API endpoint or field** → update [api.md](api.md).
- **Infra / secret / deploy change** → update [deployment.md](deployment.md).
- **A non-obvious choice with a rationale** → add an entry to
  [decisions.md](decisions.md).
- **Anything shipped** → add a dated line to [changelog.md](changelog.md), and move the
  item out of [roadmap.md](roadmap.md) if it was planned there.
- **Design/token change** → update [design-system.md](design-system.md).

If you finish a task and haven't touched any doc, stop and ask yourself which of the
above applies — usually at least one does.

### 4. Keep entries accurate and dated

- Write in the present tense about how things **are now**, not how they were.
- Convert relative dates ("last week") to absolute ones (`2026-07-09`).
- When you correct something, replace the wrong statement — don't pile a
  contradiction on top of it.
- Verify before you write: if a doc names a file, function, env var, or route,
  confirm it still exists before repeating it.

---

## How this wiki is organised

- **Orientation** (`product`, `state`, `roadmap`) — the "where are we" trio. Small,
  high-signal, updated often.
- **Reference** (`architecture`, `data-model`, `features`, `api`, `development`,
  `deployment`, `design-system`) — the durable "how it works" docs.
- **History** (`decisions`, `changelog`) — append-mostly logs of *why* and *when*.

The root `README.md` is the GitHub landing page (quick start + a link back here).
`CLAUDE.md` and `AGENTS.md` at the repo root are thin pointers that route agents to
this wiki and restate the golden rule — the real content lives here.
