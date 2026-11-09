/**
 * Club colours for the small two-tone chip beside a team name.
 *
 * Hand-kept on purpose: crest images carry licensing questions, a pair of hexes
 * doesn't. Keys are normalised names (see `normaliseTeam`) and include the
 * football-data.org short names the importer stores, plus common long forms.
 * A team that isn't listed gets no colours and the chip renders neutral — never
 * guess a colour for an unknown team.
 *
 * Literal hexes, not tokens: like the logo mark, a club's colours are the same
 * in both themes. The chip draws its own border so any pair reads on any ground.
 *
 * MIRRORED in `apps/mobile/lib/teamColours.ts` — the Expo app can't import from
 * the web's `lib/`. Change both together.
 */
export type TeamColours = { primary: string; secondary: string }

const c = (primary: string, secondary: string): TeamColours => ({ primary, secondary })

const CLUBS: Array<[names: string[], colours: TeamColours]> = [
  [["arsenal"], c("#EF0107", "#FFFFFF")],
  [["aston villa"], c("#670E36", "#95BFE5")],
  [["bournemouth", "afc bournemouth"], c("#DA291C", "#000000")],
  [["brentford"], c("#E30613", "#FFFFFF")],
  [["brighton", "brighton hove", "brighton and hove albion", "brighton & hove albion"], c("#0057B8", "#FFFFFF")],
  [["burnley"], c("#6C1D45", "#99D6EA")],
  [["chelsea"], c("#034694", "#FFFFFF")],
  [["crystal palace"], c("#1B458F", "#C4122E")],
  [["everton"], c("#003399", "#FFFFFF")],
  [["fulham"], c("#FFFFFF", "#000000")],
  [["ipswich", "ipswich town"], c("#0044A9", "#FFFFFF")],
  [["leeds", "leeds united"], c("#FFFFFF", "#1D428A")],
  [["leicester", "leicester city"], c("#003090", "#FDBE11")],
  [["liverpool"], c("#C8102E", "#00B2A9")],
  [["luton", "luton town"], c("#F78F1E", "#002D62")],
  [["man city", "manchester city"], c("#6CABDD", "#FFFFFF")],
  [["man united", "man utd", "manchester united"], c("#DA291C", "#FBE122")],
  [["newcastle", "newcastle united"], c("#241F20", "#FFFFFF")],
  [["nottingham", "nottingham forest", "nottm forest"], c("#DD0000", "#FFFFFF")],
  [["sheffield utd", "sheffield united"], c("#EE2737", "#000000")],
  [["southampton"], c("#D71920", "#FFFFFF")],
  [["sunderland"], c("#EB172B", "#FFFFFF")],
  [["tottenham", "tottenham hotspur", "spurs"], c("#FFFFFF", "#132257")],
  [["west ham", "west ham united"], c("#7A263A", "#1BB1E7")],
  [["wolves", "wolverhampton", "wolverhampton wanderers"], c("#FDB913", "#231F20")],
]

const BY_NAME = new Map<string, TeamColours>(
  CLUBS.flatMap(([names, colours]) => names.map((n) => [n, colours] as const)),
)

/** Lower-case, drop a trailing "FC"/"AFC" and punctuation, collapse spaces. */
export function normaliseTeam(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.']/g, "")
    .replace(/\b(a?fc)\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** `null` for a team we have no colours for — render a neutral chip. */
export function teamColours(name: string): TeamColours | null {
  return BY_NAME.get(normaliseTeam(name)) ?? null
}
