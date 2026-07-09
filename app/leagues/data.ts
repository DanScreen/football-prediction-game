// Seed source for the Competition table (see prisma/seed.ts and the
// platform_competitions migration). The UI reads competitions from the DB —
// this constant is not imported by components.
export const COMPETITIONS = [
  { name: "Premier League", code: "PL", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "FIFA World Cup 2026", code: "WC", flag: "🌍" },
] as const
