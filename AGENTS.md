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

## Branches

- **After a PR merges, delete its branch.** GitHub deletes the remote branch
  automatically (the repo's "delete head branch" setting is on). Delete the local copy
  yourself with `git branch -d <branch>`. If a worktree still has the branch checked
  out, switch the worktree away first, or remove it. Details:
  [docs/development.md](docs/development.md#branches).

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
