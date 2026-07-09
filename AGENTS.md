# AGENTS.md

Instructions for AI agents working in this repo (mirrors `CLAUDE.md`).

## Start here

**Read [`docs/README.md`](docs/README.md) before doing anything** — it's the project
wiki's entry point and gives you reading order, current state, goals, and next steps.
Orientation minimum: [product](docs/product.md) → [state](docs/state.md) →
[roadmap](docs/roadmap.md) → [architecture](docs/architecture.md). Load the reference
docs as your task needs them.

## The golden rule

**Whenever you change the codebase, update the docs the change affects, in the same
session.** The full mapping is in
[docs/README.md](docs/README.md#3-the-golden-rule-update-the-docs-with-every-change).

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
