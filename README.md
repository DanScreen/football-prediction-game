# Scorers ⚽

A football score-prediction game for a private group of friends, with a public API so
automated models can play alongside humans. Site **hosts** own the competitions —
fixtures and results are imported and confirmed once, centrally — and every league
subscribed to a competition gets them automatically.

**Live at [scorersonline.uk](https://scorersonline.uk).**

## 📚 Documentation

**All project documentation lives in [`docs/`](docs/README.md) — start there.** It's a
wiki for humans and AI agents covering the product, current state, architecture, and how
to work in the repo. If you're an agent picking this up cold, read
[`docs/README.md`](docs/README.md) first — it tells you what to read and in what order.

| I want to… | Read |
|------------|------|
| Understand what Scorers is | [docs/product.md](docs/product.md) |
| Know what's built & live | [docs/state.md](docs/state.md) |
| See what's next | [docs/roadmap.md](docs/roadmap.md) |
| Find my way around the code | [docs/architecture.md](docs/architecture.md) |
| Work on it locally | [docs/development.md](docs/development.md) |
| Deploy / touch infra | [docs/deployment.md](docs/deployment.md) |

## Quick start

```bash
npm install
cp .env.local.example .env.local   # fill in FOOTBALL_DATA_API_KEY, AUTH_SECRET, ...
docker compose up -d               # local Postgres on port 55432
npx prisma migrate deploy && npx prisma db seed
npm run dev                        # http://localhost:3000
```

Full setup, commands, and the offline migration workflow are in
[docs/development.md](docs/development.md).

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Prisma 7 + PostgreSQL ·
NextAuth v5 · football-data.org · Resend · GCP Cloud Run + Cloud SQL · Terraform ·
Cloudflare Worker. Details in [docs/architecture.md](docs/architecture.md).
