# Decision Log

Why things are the way they are. Append a new entry when you make a non-obvious choice;
don't rewrite history — if a decision is later reversed, add a new entry that says so.

---

## 2026-11-15 — App Store link: a text button plus Apple's Smart App Banner

The homepage links to the App Store with a button in the page's own style, not Apple's
"Download on the App Store" badge artwork. The badge has its own usage rules and would
be a downloaded asset to keep current; a plainly worded link does the job.

The Smart App Banner (`apple-itunes-app` meta, set once in the root layout) shows on
every page, signed in or out, because that is where an iPhone visitor already using
the website would benefit from the app. Safari lets them dismiss it, and it changes
to "Open" for people who have the app.

The URL is `apps.apple.com/app/id<ID>` with no country or name slug, so it lands on
the visitor's own storefront and survives a listing rename.

## 2026-11-10 — Profile pictures live in Postgres, behind unguessable public URLs

**Storage.** Pictures go in a `UserAvatar` table (bytes), not a Cloud Storage
bucket. Each is re-encoded to a 256px WebP of a few KB, so a thousand players is a
few MB. A bucket would have meant Terraform, a service-account grant and a second
place for account deletion and backups to cover; the table gets all of that for
free. Revisit if pictures ever get large or numerous enough to matter to the
database.

**Access.** `/api/avatars/<key>` needs no sign-in. The app's `<Image>` would
otherwise need an access token in its headers, which expires every 30 minutes and
would break caching. Instead the key is 144 random bits, regenerated on every
upload, and only ever shown to league-mates. Someone without the URL can't find a
picture; anyone who has it already saw it. The URL never changes meaning, so it is
served `Cache-Control: public, max-age=31536000, immutable`.

**Processing.** The server always re-encodes, whatever the client did first, so
nothing the client sends is stored as-is: no EXIF/GPS, no non-image payloads, one
format and size. The clients shrink first only to keep the upload small (and, on
the web, under the 1 MB server-action body limit).

## 2026-11-09 — The homepage is a rewrite of `/`, and the demo uses the real scorer

Signed-out visitors used to land on a login form headed "Welcome back", so nothing on
the domain explained the game. The homepage lives at `app/welcome/` and `proxy.ts`
rewrites a signed-out `/` to it. A rewrite rather than a redirect keeps the address at
the bare domain, and keeping Predictions at `/` for signed-in users means no existing
link, bookmark or test for the app itself moves. The demo imports `scoreOnePrediction`
instead of restating the rules, so a scoring change can't leave the front door wrong.

## 2026-11-09 — Steppers for scores; the app drops the text fields, the web keeps them

Entering a gameweek meant opening a number pad twenty times. − / + buttons need no
keyboard and work one-handed. One press fills both sides (the other defaults to 0)
because a half-entered pick can't be saved anyway. The app replaces its text fields
outright; the web keeps the inputs beside the buttons, since a desktop keyboard is still
the fastest way there and the end-to-end tests drive them.

## 2026-11-09 — Club colours are a hand-kept table, not crests

Crest images come with licensing questions; a pair of hex values doesn't. The table is
keyed by normalised name with the football-data short names as aliases, and an unknown
team gets a neutral chip — never a guessed colour. The app can't import from the web's
`lib/`, so the file is mirrored and a unit test fails if the two drift.

## 2026-11-09 — App leaderboard: one line per player, breakdown on tap

Each row carried up to nine figures in five colours, and "exact" appeared twice with two
meanings (points, and a count). Rows now show rank, name, form and points; the breakdown
is a stacked bar opened by tapping, and the count reads "N exact scores". Form is drawn
as bars whose height is the points scored that gameweek, which removed the printed key.
Movement arrows (up/down since last gameweek) were left out: the API has no previous
rank, and it needs a server change to add one.

## 2026-11-09 — Rules left the app's tab bar

A fifth of the navigation went to a page people read once. It is now a stack screen
opened from Account. The web keeps its Rules nav link, where space isn't scarce.

## 2026-10-23 — Residual `npm audit` findings are build tooling with no upstream fix
After the 2026-10-23 upgrade, `npm audit` still reports high findings in two places.
On the web side they're in `eslint-config-next`. On mobile they're in the
Expo/Metro/React Native toolchain. They all trace back to three packages:

- `braces` (through `micromatch`/`fast-glob`): every published version is affected.
- `node-forge` (through `@expo/code-signing-certificates`): same.
- `decode-uri-component` 0.2 (through `expo-router`'s `query-string` 7): the fixed
  0.5 line is a breaking major, and `expo-router` only moves to it in SDK 58.

The first two run on a developer's machine or in CI, at lint or bundle time, and never
handle user input in production. The third is a client-side DoS in URL decoding.
**We don't `overrides`-pin around them, and we don't take `npm audit fix --force`**:
it proposes downgrading to Expo 44 and React Native 0.72. The real fix is the Expo
SDK 58 upgrade, which is its own piece of work because it needs a native rebuild and a
store release. Re-check `npm audit` when `braces` or `node-forge` publish a fix.

## 2026-09-25 — One email template module; emails stay light-themed
Every email is built by a function in `lib/emailTemplates.ts` and rendered through
`renderEmail` (`lib/emailLayout.ts`). The earlier emails were each hand-written at their
call site, which is how one ended up branded "Football Prediction App" and another
didn't escape the display name. We use plain template strings rather than React Email
or MJML. There are three emails, and a dependency plus a build step isn't worth it
until there are many more. The emails declare a light colour scheme, not dark: client
dark-mode support is patchy, and a forced inversion of a dark design is worse than a
light one being darkened. The deadline sweep now sends through `sendEmail` like the
others. So a failed send for one user is logged and skipped rather than aborting the
sweep, and the E2E mail sink override (`RESEND_API_URL`) applies to reminders too.

## 2026-09-25 — Host user management reuses the player flows, cooldowns included
Hosts needed to see who's verified and push links to stuck players, modelled on the
Tiki Acca (`the-syndicate`) admin "Unconfirmed accounts" page. It lives at `/host/users`
(site hosts), not `/admin` (league commissioners): it covers every account on the
platform, and a commissioner shouldn't see other leagues' members' emails.
**Every action goes through the function the player's own button uses**
(`sendVerificationEmail`, `sendPasswordResetEmail`, `changeUnverifiedEmail`), so the
rules can't drift. The per-user cooldowns (60 s verification, 5 min reset) still apply
to hosts. A host double-clicking shouldn't double-mail a player, and within the window
the earlier link still works. The difference is that hosts are *told* about the
cooldown, which the public forgot-password form deliberately hides.
**Left out from Tiki Acca:** the "Remove" button and the DNS "domain can't receive mail"
check. Nobody asked for deletion, and players can already delete their own account.
The domain check can come later if junk addresses pile up.

---

## 2026-09-25 — Send the verification link automatically where users are held
Players reported that verification emails never arrived. The sending code and
production config were fine. The gap was that nothing sent the *first* link to an
account that existed before verification (2026-09-23). The web page waited for a
"Send verification email" press under the words "We'll send you a link", and the app's
screen said "tap the link we emailed" for an email that was never sent. A failed
sign-up send left the same hole.
**Decision:** landing on the gate sends the link. `ensureVerificationEmailSent` runs
on the web `/verify-email` render and on mobile `GET /me` for unverified users, and
sends only when no live link to the current address exists. So a reload or a
foreground refresh doesn't send again, and an expired link is replaced without asking.
**Why on page view and not at login:** web JWT sessions outlive the launch, so many
held users never log in again. The verify page and `/me` are the places every held
user is guaranteed to reach, on either client, with no app release needed.

---

## 2026-09-24 — Playwright E2E suite: real server, real DB, fake mail only
Several shipped bugs lived where unit tests mock things out:

- `/forgot-password` and the bot API were redirected to `/login` by `proxy.ts`;
- every fresh sign-in bounced to `/leagues` because no cookie was set.

So the suite mocks as little as possible:

- **A production build (`next start`), not `next dev`.** It is what ships, and pages
  don't compile on first hit, which would make timings flaky.
- **A real Postgres database, reset and migrated from scratch each run.** It's named
  `football_prediction_e2e`, and `prepare-db.mjs` refuses to wipe any database whose
  name doesn't end in `_e2e`.
- **Email is the one fake.** A small HTTP sink stands in for Resend, reached through a
  new `RESEND_API_URL` override. Tests click the real links in real emails, so the
  verification and reset flows are covered for real. The alternative of reading tokens
  from the database would skip the email template and the URL building.
- **Each test creates its own uniquely named data** rather than sharing a seed. Tests
  run in parallel and can't interfere, and there's no fixture file to keep in step
  with the schema.
- **The test helpers use raw SQL (`pg`) instead of Prisma.** Prisma 7's generated
  client doesn't load under Playwright's TypeScript loader.
- **Port 3217, not 3000 or 3100.** It avoids a running dev server and other local
  projects. The port is overridable.
- **Chromium only, for now.** The bugs worth catching are in the server and routing,
  not browser quirks.
- **A separate CI job, on pull requests only.** It adds a build and a browser install,
  and `deploy.yml` still gates on unit tests alone.

## 2026-09-23 — CI ships the iOS app only when its version changes
`mobile-release.yml` builds and uploads to App Store Connect after Deploy succeeds,
but only when no production build of `expo.version` exists on EAS yet.
**Why not every push, like the web deploy:** most pushes are web-only, and each
EAS iOS build costs ~15 minutes and plan quota. Uploading on every mobile change
fails too: once Apple approves a version, further uploads under it are rejected
(ITMS-90186), and that already happened by hand on 2026-09-23. Tying releases to
the version bump makes the bump the deliberate "ship it" step, and the closed-train
error can't happen.
**Why ask EAS rather than diff `app.json`:** `workflow_run` doesn't carry the push's
`before` SHA. Checking what's already built also means a retry after a failed build
still ships. **Run workflow** skips the check for a second build under the same
unreleased version.
**Why `--auto-submit --no-wait`:** EAS already holds the App Store Connect API key
and does the upload server-side after the build, so the runner doesn't idle for the
build. Submit for Review stays a human button.

## 2026-09-23 — Email verification is a hard gate, for existing accounts too
Sign-ups with junk addresses were getting in. Format checking stops typos and
nonsense; only a verification email proves the mailbox, so both shipped. Every
account — including every one created before this — must click a link before it
can use the web or the app.
**Why a hard gate and not a banner:** the problem was accounts that can't be
reached (no reminders, no password reset). A dismissible nag leaves them in the
leagues forever. Holding them on one page, where they can resend, **fix a mistyped
address**, get help or delete the account, is the minimum that actually cleans up.
The cost — every existing player clicks one link once — was judged worth it.
**How it's enforced cheaply:** the web JWT carries `hasVerifiedEmail` and the `jwt`
callback re-reads the DB only while that's false, so verified users pay nothing and
unverified sessions pick up a click from any device. Mobile routes check a flag the
access-token lookup already fetches, and answer 403 with `code: "email_unverified"`
— not 401, which the app treats as "signed out" and would loop on refresh.
**Carve-outs:**
- The bot API (`/api/v1`) isn't gated — bots authenticate by API key, which an
  account can only mint from `/profile`, behind the gate.
- The App Store reviewer's demo account is backfilled verified in the migration:
  nobody reads that inbox, and a reviewer stuck on "check your inbox" rejects.
- Changing the address is allowed only while unverified, and it invalidates
  outstanding **password-reset** links too — a completed reset now verifies the
  current address, so a link sent to the old one mustn't vouch for the new one.
- A link is verified on render (GET), and a re-opened used link on a verified
  account still says "verified": mail scanners pre-fetch links, and a scanner
  verifying the owner's own mailbox is harmless.
- The session claim is `hasVerifiedEmail`, not `emailVerified`: NextAuth's
  `AdapterUser.emailVerified` is a `Date | null` and the types collide.

---

## Host metrics come from Postgres, not a product-analytics SaaS
Site-host user counts and activity live in the app DB and show on a `/host`
overview. We do **not** wire PostHog / Amplitude / GA as the source of truth.
**What we track**
- **Volume (derived, no new writes):** `User` rows (split `isBot`),
  `User.createdAt` for signups, `League` / `LeagueMembership` counts,
  `Prediction` counts (and `submittedVia` for web vs API), mobile reach via
  `MobileDeviceToken` / non-revoked `MobileRefreshToken`.
- **Presence (one new field):** `User.lastSeenAt`, bumped on login
  (`authorize`), prediction upsert, and mobile token refresh — **throttled**
  (e.g. at most once per ~15 minutes per user) so JWT sessions don't turn into
  a write storm. DAU / WAU / MAU = distinct users with `lastSeenAt` in the last
  1 / 7 / 30 days. Optional later: `lastLoginAt` if "signed in" must differ from
  "did something".
- **No event log in v1.** Predictions already are the product's meaningful
  actions. A `UserActivityEvent` (or daily rollup) only if we later need funnels
  that existing tables can't answer (e.g. visited Predictions but never picked).
**Where it shows**
- **Site hosts (`/host`):** replace the index redirect with an overview —
  totals (users, humans, bots, leagues), active (DAU/WAU/MAU), recent signups,
  prediction volume (7d / 30d), and a simple recent-users table. Web-only, gated
  by `requireSiteAdmin()`.
- **Commissioners (`/admin`):** stay **league-scoped**. Keep pick status as the
  activity view; do **not** expose platform-wide user counts. Optional later: a
  small member pulse (joined date, last pick) on `/admin/picks`.
**Why:** Scorers is a private friends game with one host audience. Almost every
useful number already exists as relational data; a third-party analytics stack
would add cookies, privacy surface, and another vendor for metrics a SQL query
already answers. Throttled `lastSeenAt` is the only gap JWT sessions leave
(stateless auth never records "was here"). Keeping commissioners league-only
matches the existing auth split and avoids leaking other leagues' membership.

---

## Player features go on both clients; admin features stay on the web
Anything a player uses ships on the web *and* in the app. Host (`/host`) and
commissioner (`/admin`) tools are web-only and will not be ported.
**Why:** players choose a client by preference, so a feature that exists in only
one makes the product feel unfinished — "it's on the website" answers nothing
for someone holding a phone. The gameweek leaderboard shipped app-first and was
immediately backfilled to the web for exactly this reason. Admin inverts every
term: it's occasional, deliberate, desk-bound work over dense tables that a
phone renders badly, and it serves one person who already owns a laptop —
building the hardest screens twice for that is a bad trade. The rule also has
teeth in review: a player-facing PR that touches one client should say where the
other one is.

## "Finished" is its own column, not a reuse of `isActive`
`Competition.archivedAt` (nullable timestamp) marks a competition a host has
declared over; `isActive` stays what it always was — whether the competition is
auto-imported and offered when creating a league.
**Why:** the two states genuinely differ. A season is routinely closed to new
leagues part-way through (`isActive: false`) while still being played, and the
people in it must keep predicting it. Overloading the flag would have thrown
them off Predict the moment a host stopped taking new leagues. A timestamp
rather than a boolean because "when did this end" is the useful thing to show on
the host page and in the finished-leagues section, and it costs nothing extra.
The filter lives in exactly one function, `resolvePeerContext()` in
`lib/peers.ts`, so a new core page inherits it instead of re-deriving it.

## Finishing hides, never deletes
An archived competition keeps every fixture, prediction, bonus award and
standing; it just stops appearing on the core pages. Its leagues move to a
"Finished leagues" section on `/leagues`, and `/leaderboard?archived=1` still
renders the final table.
**Why:** the complaint that prompted this was "I'm tired of seeing the World Cup
in my app" — a clutter problem, not a data problem. Final standings are the
point of having played, so destroying them to tidy a list would be a bad trade.
Unticking the box fully reverses it.

## The app's streak bonus arrives on its own endpoint
`GET /api/mobile/v1/bonuses` returns the viewer's streak bonuses per competition
and round; the Results tab merges them into each round subtotal.
**Why:** the fixtures payload is league-agnostic (a fixture belongs to a
competition, and the app shows every league-mate's pick on it), but a bonus is
awarded per league. Folding it into a fixture would mean picking one league
arbitrarily. Fetching it separately and summing across the viewer's leagues on
that competition is exactly what the web results page does, so the two now show
the same number.

## Store screenshots are captured from the real app under react-native-web
`scripts/capture-store-shots.mjs` runs the Expo app in headless Chrome with the
viewport forced to 430 × 932 at deviceScaleFactor 3, giving native 1290 × 2796
PNGs; `scripts/build-store-promos.mjs` frames and captions them.
**Why:** this Mac has Command Line Tools only, so there is no iOS Simulator to
shoot, and EAS cloud builds cannot be screenshotted either. The alternatives were
hand-drawn mockups (which drift from the product the moment the UI changes) or
waiting on a full Xcode install. react-native-web renders the same components,
tokens and API responses, so a capture is a real render rather than a drawing —
and the whole set regenerates in one command when the UI moves. The known limit
is that it is *web* RN: native-only chrome (the real status bar, iOS momentum
scrolling, SF Symbols rendered by the OS) is approximated, so eyeball the set
against a device build before uploading.

## Account deletion removes the user but keeps their leagues
`lib/accountDeletion.ts` deletes every row that references the user, then the
user, in one transaction — but a league survives unless the leaver was its last
member. **Why:** a league is a shared object. One player quitting must not
destroy everyone else's standings, even when that player created it; there is no
"owner" whose departure should be fatal. A league with nobody left is deleted
because its invite code was the only way in and nobody holds it any more. The
children are deleted explicitly rather than by adding `onDelete: Cascade` to the
schema: a cascade is invisible at the call site and would silently widen the
blast radius of any future `user.delete`, whereas this is one function that says
what it destroys. Required by App Store guideline 5.1.1(v), which is why it
exists now rather than later.

## The privacy policy is a page in the app, not a hosted document
`/privacy` is a React page in this repo, listed in `PUBLIC_PATHS`.
**Why:** the store listing needs a stable URL that a reviewer can open without an
account, and the policy has to stay true as the app changes. Keeping it in the
codebase means it shows up in the diff when someone adds a data collection, and
it inherits the design system rather than looking like a document from another
company. It replaces `/rules`, which the store-release doc used to nominate and
which is the rules of the *game* — that would not have survived review.

## Logo is drawn geometry in one shared module, not `<text>` and not per-platform files
The mark's paths live in `lib/mark.ts`; `app/components/Logo.tsx` renders them as JSX and
`scripts/generate-brand-assets.mjs` rasterises every PNG from the same `markSvg()`.
**Why:** the mark was previously set in SVG `<text>` with `var(--font-mono)`, so the
digits reflowed depending on whether the font had loaded and disappeared entirely when
rasterised — a font-dependent logo can't become an app icon. Keeping one module also
fixes the drift that let the site show the scoreline mark while the Expo app shipped the
stock template icon; the assets are committed, not built on demand, so regenerating is a
deliberate `npm run brand:assets` step. Chosen over concept B (an S monogram, safer at
16px) and concept C (a pitch/kick-off mark, a stronger long-term graphic system but a
bigger change than a pre-store-release app needed).

## Platform-owned competitions (hub-and-spoke)
Fixtures/results moved from per-league to a shared `Competition` that leagues subscribe
to (`League.competitionId`, `Fixture.competitionId`). **Why:** every league was
re-importing the same fixtures and re-confirming the same results — duplicated work and
data. Now site hosts own competitions and confirm results once; leagues get them
automatically. This replaced the old cross-league prediction sync — with canonical
fixtures, one prediction per user per fixture already counts across all their leagues.

## Site-host role via `SITE_ADMIN_EMAILS`
`User.isSiteAdmin`, bootstrapped from the `SITE_ADMIN_EMAILS` env var and synced on
login; `requireSiteAdmin()` re-checks the DB per request. **Why:** hosts are a
platform-level role distinct from per-league `COMMISSIONER`. Env-var bootstrapping means
no chicken-and-egg problem granting the first host, and the per-request DB re-check makes
revocation immediate. Gates `/host`; commissioners keep `/admin` (settings only).

## Provisional scores/points shown everywhere, ranked by confirmed
Once the sweep pre-fetches a proposed score, projected scores/points appear across the
predictions page, leaderboard, and API (badged amber), computed at read time
(`lib/provisional.ts`) and **never stored**. Standings rank by confirmed points only.
**Why:** the game should feel live the moment a result is known, but a human host must
still confirm before anything official scores (postponements, TBD teams, ambiguous
names). Provisional gives immediacy without letting unconfirmed data move the table.

## Host confirm queue, not auto-confirm (with Accept All)
Results are pre-fetched automatically but require host confirmation. **Why:** football
data is occasionally wrong; a quick human check keeps bad data off the leaderboard.
**Accept All** keeps it low-effort when the data is clean.

## Score once, fan out round bonuses per league
Confirming a result scores every prediction on the canonical fixture once, then awards
the round bonus per subscribing league (`lib/results.ts`). **Why:** base points are
competition-global (one canonical fixture) but *membership* is per-league, so the bonus
row has to exist once per league even though its value is now identical everywhere.
(Until 2026-08-16 the value varied too — see the streak-bonus entry below.)

## Cron cadence 30 min → 10 min
**Why:** with fixtures/results now automatic, tighter cadence means fresher imports and
faster provisional results. Cloud Scheduler cost at this frequency is negligible.

## Cron `app_url` points at the direct run.app URL
The scheduler calls the Cloud Run URL directly, not `scorersonline.uk`. **Why:** a
machine-to-machine cron call shouldn't depend on the Cloudflare Worker proxy; auth is
via `CRON_SECRET` so the Host header doesn't matter. (Also: the scheduler resource only
exists when `app_url` is set — it had never been created until this was configured.)

## Skip fixtures with undecided (TBD) teams on import
`fetchUpcomingFixtures` drops fixtures whose team names are null. **Why:** knockout
fixtures with undecided teams (e.g. World Cup semi-finals) come back with null names and
violated `Fixture.homeTeam` NOT NULL — this 500'd the entire resolve sweep in prod.

## Fresh-start migration for the refactor
The competitions-refactor migration deletes all Prediction/BonusAward/Fixture rows and
drops leagues that don't match a seeded competition. **Why:** the app was effectively
unused, so a clean cut was simpler and safer than a full data migration. Leagues are
backfilled to their `Competition` by name; unmatched ones (and their memberships) are
removed. Verified against a throwaway Docker Postgres before shipping.

---

## 2026-08-16 — Dark mode via token swap, not `dark:` variants

Tailwind's usual answer is a `dark:` variant per element. That was rejected: the app
had 137 stock colour classes across 26 files, so it would have meant ~137 paired
variants to write and keep in sync forever, and the design system already said "use the
tokens, don't hardcode".

Instead every stock colour became a semantic token (`good`/`bad`/`info` alongside the
existing `pitch`/`clock`), and the dark theme is a single `@media (prefers-color-scheme:
dark)` block redefining the variable *values*. No component has a dark-mode branch, and
new UI is dark-ready for free as long as it uses tokens.

Two consequences worth knowing:
- **`pitch-on`** exists because the accent inverts. In light, labels on a green button
  are white; in dark the green brightens for legibility as text, so labels must go
  near-black. `text-white` on a button is therefore always wrong.
- **`pitch-deep` is lighter than `pitch` in dark mode** — hover should still move toward
  the light.

**Three-state toggle** (System / Light / Dark) in the header, not a two-state switch:
"follow my OS" is a real preference and the default, so a light/dark switch would strand
anyone wanting to return to it. The choice is a non-`httpOnly` `theme` cookie — a device
preference rather than account data, so it survives sign-out — read server-side in the
root layout and rendered into `<html data-theme>`, which avoids a flash of the wrong
theme on first paint. `"system"` sets no attribute at all, letting the media query win.

Consequence: `lib/theme.ts` (pure constants, safe for Client Components) is deliberately
split from `lib/theme.server.ts` (the `next/headers` cookie read). Merging them breaks
the build, because the client toggle imports the constants.

**The board palette went from navy to deep pitch green** (`#0f4527` light, `#061a0f`
dark). The navy was inherited from the original "darker concept" pitch and read as a
borrowed element sitting apart from a product whose accent is green; gold on deep green
is also the more football image. It is *lighter* in light mode than in dark: against a
white page a near-black slab reads as a harsh hole, while against the dark ground it
must go deeper than the surface to stay a raised panel. `board-muted` follows in both
directions. Dropped `board-cyan` at the same time — defined but never used.

## 2026-08-16 — Bottom tab bar for mobile navigation

Chosen over a hamburger drawer. The app has only a handful of destinations and is
checked in short bursts around match times, so keeping them all one thumb-tap away beats
hiding them behind a menu that costs a tap and needs open/close state. The desktop top-bar nav
is unchanged; both render from one link list in `NavLinks.tsx`.

## 2026-08-16 — Merge Dashboard into Predictions, and scope pages by competition

Two changes with one root cause: the app applied "active league" to surfaces that aren't
per-league.

**Dashboard and My Predictions merged into `/`.** They showed the same thing either side
of kickoff — your picks and their results — and Dashboard was the only place you could
actually enter a prediction, so the split forced you between two pages to do one job.
One page now runs Open → Kicked Off → Results. `/predictions` is a permanent redirect.

**Predictions are scoped by competition, not league.** A `Prediction` is unique per
`(userId, fixtureId)` with no `leagueId`, so a pick already counts in every league on
that competition. Rendering this page per-league would have shown the same fixtures with
the same inputs once per league, all writing to the same row. Leagues only decide whose
picks appear beside yours — resolved as "everyone sharing a league with you *on that
competition*".

**The leaderboard stacks every league instead.** Standings are the one genuinely
per-league surface, so that is where seeing several at once pays for the page length,
and it removes the need to switch leagues to read a different table.

**Consequence:** the `activeLeagueId` cookie now only drives `/admin`, so it resolves
with a `COMMISSIONER` filter (`resolveCommissionerLeagueId`). Without the filter, a user
who is a plain member of their earliest league and commissioner of another gets bounced
out of `/admin`. The header's Admin chip likewise keys off commissioning *any* league.

## 2026-08-16 — Invite links, and sign-up is open by design

Sharing a league meant sharing a 6-character code and hoping the recipient found the
site, spotted "Register", and typed the code into an optional box. Now `/register?invite=
CODE` carries it for them and joins the league on account creation.

**The invite field was removed from sign-up entirely.** It was optional, so most people
had to ignore it, and it was the wrong place to ask: someone arriving from a link
shouldn't retype what the link already said, and someone arriving cold has no code. Codes
now belong on the "Join a league" form, where you use them once you have an account.

**Sign-up is open** — no code required to create an account, which is what the code has
always done despite the docs and on-page copy claiming "invite-only". Resolved in favour
of the behaviour: *leagues* are private (link or code required), *accounts* are not. The
login/register copy was corrected to match, which matters because that copy exists partly
to reassure Google Safe Browsing — it should be true.

Two deliberate consequences:
- **A bad invite code never blocks registration.** It arrives from a link the user can't
  see or fix, so failing them at the door would be hostile. They get the account and a
  notice to join a league later.
- **`normaliseInviteCode()` is used at both entry points.** They had drifted: registration
  did `.trim()` while joining did `.trim().toUpperCase()`, so a lowercase code was
  rejected at sign-up but accepted when joining.

## 2026-08-16 — Banker: one double-points pick per gameweek

**It cannot be a per-league toggle** (as the Grand Slam then was). `Prediction.pointsAwarded`
is competition-global — one pick, scored once, counting in every league on that
competition — so a doubling can't apply in one league and not another. The Grand Slam
got to be optional precisely because it lived in a separate per-league `BonusAward`
row. Banker is therefore on for everyone, everywhere. Making it optional would mean
per-league points, which is the design the competitions refactor deliberately removed.

**Stored as `isBanker` on Prediction, not a `BankerPick` table.** The multiplier applies
to one prediction's points, so it belongs on that row: scoring reads it where it already
is, and the leaderboard needs no extra join. The cost is that "one per (user,
competition, round)" can't be a unique index — `round` lives on Fixture — so
`setBanker()` enforces it in a transaction that clears the old pick and sets the new one
together. Acceptable: a single user racing themselves is the only contention.

**Two kickoff locks, both about hindsight.** You can't banker a fixture that has kicked
off, and you can't move a banker *off* one that has — otherwise you could bank the
Saturday lunchtime game, watch it go badly, and shift the double onto Sunday.

**`awardedPoints()` is separate from `scoreOnePrediction()`.** Two callers genuinely
need the undoubled figure: bonus eligibility asks "was the result right?", not "how
many points?", and the round-completion pass in `confirmFixtureResult` re-derives every
prediction in the round. That pass previously normalised to base points — left alone, it
would have silently stripped the double off a whole round the moment it completed. There
is a test pinning exactly that.

**Upside-only, and that's the intent.** The minimum score is 0, so a banker can never
cost points. The decision is which fixture you're most confident in, not how much to
risk — a risk-bearing version (halving a wrong banker) would punish the players who
predict the most fixtures, which runs against a game meant to be light to play.

## 2026-08-16 — Streak bonus replaces the Grand Slam

The Grand Slam paid a fixed bonus for getting *every* result in a round right. The
streak bonus pays **1 / 2 / 3** points for **5–7 / 8–9 / 10+** correct results in a
gameweek.

**Why tiers.** All-or-nothing almost never paid out — one wrong result in ten wiped the
whole bonus — so it was a rule most players read once and then ignored. Tiers give a
good week something to aim at without needing a perfect one, and the top tier still
rewards a clean sweep of a 10-fixture matchweek.

**It is no longer a per-league setting.** `grandSlamEnabled` / `grandSlamPoints` were
dropped from `League` (migration
`20260816010000_streak_bonus_replaces_grand_slam`). Scoring is now identical in every
league, which makes standings comparable and one less thing for a commissioner to get
wrong. `BonusAward` stays per-league because *membership* is per-league — the row must
exist once per league even though its value no longer varies.

**Consequences accepted:**
- **Rounds shorter than 5 fixtures can't pay anything.** Fine for a Premier League
  matchweek; a World Cup knockout round of 4 pays nothing. Judged acceptable rather than
  scaling the tiers to round size, which would make the rule harder to state than it is
  worth.
- **Existing `BonusAward` rows were left alone** by the migration. They record what was
  actually awarded at the time; deleting them would quietly remove points from settled
  rounds. New awards use the tiers from the next confirmed gameweek onwards.
- **`grandSlams` became `streakPoints` in the leaderboard and the public API** — a
  breaking field rename. It reports total bonus points rather than a count, because with
  tiers a count hides whether someone scored three 1s or three 3s.
- **`/rules` stopped being personalised.** Per-league Grand Slam settings were the only
  thing on it that varied.

**Tiers live in `STREAK_TIERS`** and every surface renders from it — the settings page,
`/rules`, and the scoring itself — so the numbers cannot drift apart.

**Close points follow Superbru exactly** (2026-08-16). "Close" is the right result plus
a scoreline within one goal, not merely a matching goal difference. Superbru express it
as a Closeness Index — `|your GD - actual GD| + |your total goals - actual total goals|
/ 2`, close at <= 1.5 — but the code checks per-side goal offsets instead, because the
two are provably equivalent and offsets are what players actually reason about.

Already-scored predictions were **not** rescored. The change moves points in both
directions, the affected rounds are settled, and silently restating finished
leaderboards is worse than a clean cutover. Anything confirmed before this date keeps
the points it was awarded.

---

## 2026-08-16 — Native apps via Expo in a monorepo; separate mobile API

Scorers will ship **iOS and Android** player apps with **Expo (React Native)**, in the
same git repo as the website (`apps/mobile/`, web relocates to `apps/web` later). Full
plan and Phase 1 contract: [mobile.md](mobile.md).

**Why Expo, not Swift+Kotlin or Flutter:** one TypeScript codebase, fits Cursor and the
existing Next stack, one path to both stores. **Why not a WebView/Capacitor shell:** the
product needs a real native client over HTTP, not the website framed in a store binary.

**Why a new `/api/mobile/v1` instead of `/api/v1`:** the bot API is API-key auth and
league-default scoped for automation. Phones need email/password → short-lived access +
rotating refresh tokens, and response shapes closer to the web player UX (competition-
scoped fixtures, stacked leaderboards). Bots stay on `/api/v1` unchanged.

**Why API before Expo UI:** without login and player endpoints, the app cannot do
anything real; scaffolding screens first would invent a fake client against cookies.

Host/commissioner flows remain web-only for v1.

---

## 2026-08-22 — Auto-save score inputs (no Save button)

Predictions save as soon as both home and away are valid integers (debounced typing +
blur). **Why:** an explicit Save button was friction for a two-number pick; once both
scores are in, the intent is clear. Banker stays gated on a saved prediction so you
can't banker an empty card. Mobile matches the web.

---

## 2026-08-22 — Auto-confirm API results; hosts edit after the fact

Results from football-data.org are confirmed automatically as soon as the sweep finds
them — no provisional/pre-confirm step, no **Accept All**. Site hosts can still enter a
missing result or **edit a confirmed score** from `/host/results` or `/host/fixtures`;
saving re-scores every prediction and updates streak bonuses. **Why:** the manual
confirm step added friction once results were reliable enough; correction after the
fact is enough when the API is wrong. Supersedes the 2026-08-16 provisional/confirm-queue
decisions below (those entries are kept for history).

**Follow-up (2026-09-19):** auto-confirm alone left a hole — football-data.org can
publish `FINISHED` with a score that later changes (disallowed goal / post-whistle VAR).
Once a fixture was `COMPLETED`, the sweep never looked it up again, so the wrong
score stuck until a host edited it. The sweep now **reconciles** recent
`AI_CONFIRMED` results for 24h after kickoff (`RESULT_RECONCILE_WINDOW_MS` in
`lib/resolution.ts`), re-applying a changed scoreline via the same
`confirmFixtureResult` path. Host `MANUAL` edits are never overwritten.

---

## 2026-08-22 — Split Predictions and Results tabs

**Predictions** (`/`) = Open + Kicked Off (active pick flow). **Results** (`/results`) =
settled fixtures with every league-mate's pick. Mobile gets a fifth tab bar item.
**Why:** the single combined page grew without bound as settled rounds accumulated and
each fixture now lists every league-mate; splitting active vs archive matches how
people use the app. Open fixtures stay private until kickoff.

---

## 2026-08-22 — Results section shows all league-mate picks

The Predictions **Results** section lists every league-mate's settled pick per fixture,
not just the viewer's. Same peer filter as Kicked Off (everyone sharing any league on
that competition). Round headers still show **your** subtotal and streak bonus only.
The mobile app mirrors this: `peerPredictions` on `/api/mobile/v1/fixtures` after
kickoff, shown on Kicked off and Results cards. **Why:** comparing picks after a round
settles is part of the social loop; hiding others' picks in Results while showing them
in Kicked Off was inconsistent. Open fixtures stay private until kickoff.

---

## Foundational stack decisions (earlier)

- **Prisma 7 + `@prisma/adapter-pg`** — Prisma 7 dropped no-adapter mode; the runtime
  client needs an explicit `pg.Pool` + `PrismaPg` adapter (`lib/prisma.ts`). Client is
  generated to `app/generated/prisma` (import from `@/app/generated/prisma/client`).
- **NextAuth v5 beta, JWT sessions** — stateless; no DB adapter for sessions. Both
  `AUTH_SECRET` and `NEXTAUTH_SECRET` must be set.
- **football-data.org for fixtures + results** — REST API, free tier covers PL + World
  Cup. No AI/LLM dependency for data. Manual entry is the fallback when unconfigured.
- **Cloud SQL ENTERPRISE edition** — required for `db-f1-micro` (ENTERPRISE_PLUS is the
  default but incompatible).
- **Cloud Run ↔ Cloud SQL via Unix socket** at runtime (`?host=/cloudsql/<instance>`);
  CI migrations use a TCP URL via the Cloud SQL Auth Proxy.
- **Active league in an `httpOnly` cookie** (`activeLeagueId`) rather than URL segments,
  keeping routes unchanged across league switches. Since 2026-08-16 this only affects
  `/admin` — see the IA entry above.
- **Cloudflare Worker for the custom domain** — europe-west2 supports neither Cloud Run
  domain mappings nor Firebase Hosting rewrites, so a Worker proxies the domain.
- **`"use server"` files export functions only** — Turbopack errors on exported
  constants; shared constants live in plain `.ts` files.
- **Route middleware is `proxy.ts`** (Next.js 16 convention), with `PUBLIC_PATHS` for
  unauthenticated routes.
- **Gameweek moves clear the *arriving* banker, not the incumbent** — moving a fixture
  between rounds can put two of a player's bankers in one round, which no database
  constraint prevents. `reassignRound()` keeps the banker already in the destination
  round and clears the one that arrived with the move: the player chose the incumbent
  against the round as they saw it, and the moved fixture is what changed underneath
  them. The host sees a count of what was cleared so affected players can be told.
- **Host bulk edits refuse settled fixtures outright** rather than trying to re-score.
  Reversing points and streak bonuses across leagues is more machinery than the problem
  warrants, and a wrong gameweek label on finished history is cosmetic.
