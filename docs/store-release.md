# Store release (Phase 5)

Bundle id: **`uk.scorersonline.app`**
Deep link: **`scorers://join?code=ABCDEF`**
Default API: `https://scorersonline.uk`

The listing copy — every field App Store Connect asks for, ready to paste — lives
in [`store-assets/app-store-listing.md`](../store-assets/app-store-listing.md).
The images it refers to are in `store-assets/promo/` (upload these) and
`store-assets/screens/` (the raw app captures they are built from).

---

## Submission readiness

| Requirement | State |
|---|---|
| In-app account deletion (guideline 5.1.1(v)) | ✅ Leagues → Account → Delete account, and `/profile` on the web |
| Privacy policy URL | ✅ `https://scorersonline.uk/privacy` |
| App icon (not the Expo template) | ✅ the scoreline mark, `npm run brand:assets` |
| Screenshots, 6.9" iPhone | ✅ `store-assets/promo/` |
| Listing copy, keywords, review notes | ✅ `store-assets/app-store-listing.md` |
| Export compliance | ✅ `ITSAppUsesNonExemptEncryption: false` in `app.json` |
| Apple Developer Program membership | ⛔ needs your account |
| `eas login` / `eas build` / submission | ⛔ needs your account |
| Production demo account for the reviewer | ⛔ create `review@scorersonline.uk` on prod |
| iPad screenshots **or** `supportsTablet: false` | ⛔ decide before submitting |

The last four are out of agent scope — they need Apple credentials or a decision.

> **iPad:** `app.json` sets `supportsTablet: true`, so App Store Connect will
> demand a 13" iPad screenshot set (2064 × 2752) as well. If you do not want to
> produce those, set it to `false` and ship iPhone-only for 1.0.

---

## Test on your iPhone (development build — no Expo Go)

App Store Expo Go cannot run this project's **SDK 57**. Install a **custom Scorers
build** on the phone instead. This Mac has Command Line Tools only (no full Xcode),
so use **EAS cloud builds**, not `npx expo run:ios`.

### 1. Apple Developer Program (paid, ~£79–99/year)

1. Enrol at [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll)
2. Wait until membership is **Active** (minutes to a couple of days)
3. Sign any pending agreements in App Store Connect

A free Apple ID is **not** enough for EAS installs on a physical iPhone.

### 2. Expo / EAS account

```bash
npm install -g eas-cli   # optional; npx eas works too
eas login
cd apps/mobile
eas init                 # creates/links the EAS project
```

The project UUID already sits in `app.json` → `extra.eas.projectId`.

### 3. Register your iPhone + build

```bash
cd apps/mobile
eas device:create        # open the link on your iPhone to register its UDID
eas build --platform ios --profile development
```

When the build finishes, open the install link on the **iPhone** (Safari), trust the
developer under **Settings → General → VPN & Device Management**, then open **Scorers**.

### 4. Start Metro and connect

```bash
cd apps/mobile
npx expo start --dev-client
```

Same Wi-Fi as the Mac. The Scorers app loads the JS bundle from Metro. API defaults
to production (`https://scorersonline.uk`).

---

## Build and ship

```bash
cd apps/mobile
eas build --platform ios --profile development
eas build --platform ios --profile preview
eas build --platform ios --profile production
```

Then TestFlight → App Store review.

---

> ⚠️ **The committed screenshots are stale as of 2026-09-04.** They were captured on
> 2026-08-28, before the App Store branch was reconciled with `main`. Since then the
> prediction card has gained league-mate picks and autosave status, Results moved to
> its own tab, and the account and sign-up screens gained privacy-policy links — so
> what ships no longer matches the images. Re-run the capture below before submitting.

## Regenerating the store screenshots

There is no iOS Simulator on this machine (Command Line Tools only), so the
screenshots are captured from the **real app running under react-native-web** in
headless Chrome, with the viewport forced to 430 × 932 at deviceScaleFactor 3 —
native 1290 × 2796, Apple's 6.9" size. Same components, same tokens, same API
responses; only the renderer differs. See [decisions.md](decisions.md).

Four terminals, then two commands:

```bash
# 1 — database with a season's worth of demo data
docker compose up -d
export DATABASE_URL="postgresql://postgres:localdev@localhost:55432/football_prediction_app"
npx prisma migrate deploy && npx prisma db seed
npm run store:seed          # 8 players, 4 settled rounds, bankers, streaks

# 2 — the API
DATABASE_URL="$DATABASE_URL" npm run dev            # :3000

# 3 — one origin for app + API, so the browser sees no cross-origin request
npm run store:proxy                                 # :8090

# 4 — the app itself
cd apps/mobile && EXPO_PUBLIC_API_URL=http://localhost:8090 npx expo start --web --port 8082
```

```bash
npm run store:shots   # capture the app, then compose the framed panels
```

`store:capture` writes `store-assets/screens/*.png` (bare app screens);
`store:promos` writes `store-assets/promo/*.png` (framed, captioned — the ones you
upload). Edit the `PANELS` array in `scripts/build-store-promos.mjs` to change a
headline or which screen a panel uses.

The set is **all dark**, on a dark background, because that is the better-looking
theme and one palette makes the six panels read as a sequence. Light captures of
the predictions and leaderboard screens are still produced as alternates; to use
one, point a panel at it and flip `PANEL_THEME`.

Two things worth knowing when adding a panel:

- A panel showing a **short screen** (the rules screen, say) should set `frameH`
  so the device closes inside the canvas. The default frame runs off the bottom
  edge, which looks deliberate over a long screen and looks broken over a short
  one that ends in empty ground.
- To show a **different part** of a screen, scroll it in `capture-store-shots.mjs`
  via `scrollToText` and capture it separately. Do not try to slide the image
  inside the frame — at the default size the capture is shorter than the frame,
  so there is nothing to slide.

`npm run store:seed` is destructive to the **local** Premier League fixtures and
their predictions, and is idempotent. It owns the whole demo picture — two
leagues (`The Sunday League`, `Five-a-side FC`), eight players, four settled
gameweeks, one awaiting confirmation and two open — and detaches the hero
account from anything an earlier local session left behind, so the screenshots
are reproducible. Never point it at production.

---

## App Store Connect

All the copy is in
[`store-assets/app-store-listing.md`](../store-assets/app-store-listing.md):
name, subtitle, description, keywords, promotional text, categories, age rating,
review notes, and the exact privacy-nutrition answers.

Two things it flags that you must do by hand:

1. **Create the reviewer's demo account on production** and join it to a league
   with history. A reviewer landing on an empty Predictions screen is a common
   rejection.
2. **Age rating:** answer *No* to Simulated Gambling and to Contests. Scorers has
   no stake, odds, virtual currency, prizes or in-app purchases; answering yes
   pushes it to 17+ for no reason.

## Permissions copy

- **Notifications** — "Scorers sends reminders when fixtures you have not predicted are about to kick off."

## Out of agent scope

Apple/Google payments, `eas login`, installing on the phone, and creating the
production reviewer account all need your accounts.
