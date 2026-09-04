# App Store Connect — submission fields

Everything App Store Connect asks for, ready to paste. Character limits are
Apple's; the counts in brackets are what the copy below actually uses.

Regenerate the screenshots with the two scripts in `scripts/` — see
[store-release.md](../docs/store-release.md#regenerating-the-store-screenshots).

---

## App information

| Field | Value |
|---|---|
| **App name** (30) | `Scorers: Football Predictions` (29) |
| **Subtitle** (30) | `Predict scores, top the table` (29) |
| **Bundle ID** | `uk.scorersonline.app` |
| **SKU** | `scorers-ios-001` |
| **Primary category** | Sports |
| **Secondary category** | Games → Trivia |
| **Primary language** | English (U.K.) |
| **Content rights** | Does not contain, show, or access third-party content |
| **Age rating** | 4+ — no objectionable content. Answer "None" to every questionnaire item, including Contests and Simulated Gambling. |

### Age-rating notes

Answer **No** to "Simulated Gambling" and to "Contests". Scorers has no wagering,
no virtual currency, no prizes and no in-app purchases — players predict
scorelines for points on a private leaderboard. Getting this wrong pushes the
rating to 17+ unnecessarily.

---

## URLs

| Field | Value |
|---|---|
| **Support URL** | `https://scorersonline.uk/rules` |
| **Marketing URL** | `https://scorersonline.uk` |
| **Privacy Policy URL** | `https://scorersonline.uk/privacy` |

> The privacy policy is a real page as of this release — it used to point at
> `/rules`, which is the rules of the game and would not have satisfied review.

---

## Promotional text (170 max, editable without a new build)

```
New: pull-to-refresh predictions, a form strip on every leaderboard, and push reminders before kickoff so you never miss a deadline again.
```
(141)

---

## Description (4000 max)

```
Scorers is a football score-prediction game for you and your friends.

Predict the exact scoreline of every fixture in a gameweek, then watch the real results come in and see who actually knows their football. No stake, no odds, no gambling — just you, your mates, and a league table.

HOW IT PLAYS

Pick a scoreline for each fixture. Each fixture's own kickoff is its deadline, so you can change your mind right up to the whistle. After kickoff your pick locks and everyone's is revealed.

Nominate one fixture a gameweek as your Banker and it scores double — pick the one you are most confident in. There is no downside, so the skill is knowing what you actually know.

Points work the way you would expect:
• Exact score — 3 points
• Right result, scoreline within one goal — 1.5 points
• Right result only — 1 point
• Wrong result — nothing

Call most of a gameweek's results right and you pick up a streak bonus on top.

FIXTURES AND RESULTS, HANDLED

Nobody in your league has to type in a fixture list or chase a result. Fixtures arrive automatically for the competitions you follow, and results are fetched as matches finish. You see a provisional score and provisional points the moment a result lands, so the game feels live, and the official table only moves once a result has been confirmed.

YOUR LEAGUES

Leagues are private. Start one and share the invite link, or tap a friend's link to join. You can be in as many as you like — one prediction counts across every league you are in on that competition, so there is nothing to enter twice.

The leaderboard shows the full table, where each player's points came from (results, close calls, exact scores, bankers, streaks), how many exact scores they have landed, and a form strip for their last five gameweeks.

REMINDERS

Turn on notifications and Scorers nudges you when a fixture you have not predicted is about to kick off. Nothing else — no marketing, no noise.

PLAYS NICELY WITH BOTS

Scorers has a public API, and prediction bots compete on the same leaderboard as humans. If you have ever wanted to find out whether your model beats your friends, this is the game for it.

DARK MODE, AND YOUR ACCOUNT IS YOURS

The whole app follows your system light or dark setting. There is no advertising, no tracking and no analytics SDK. You can delete your account, and everything in it, from inside the app at any time.

Scorers is free. There are no in-app purchases and nothing to unlock.
```
(2,079)

---

## Keywords (100 max, comma-separated, no spaces after commas)

```
football,soccer,predictor,score,prediction,fixtures,league,leaderboard,gameweek,friends,table,premier
```
(107 → trim to fit; see below)

**Use this 100-character version:**

```
football,soccer,predictor,prediction,fixtures,league,leaderboard,gameweek,friends,table,premier
```
(94)

Do not repeat words already in the app name or subtitle — Apple indexes those
separately, so "Scorers", "scores", "predict" and "table" are wasted there. (The
list above keeps "table" deliberately; drop it if you re-add it to the subtitle.)

---

## What's New in This Version (4000 max) — for version 1.0.0

```
The first release of Scorers for iPhone.

Everything from the website, in your pocket: predict scorelines, set your banker, see provisional scores as results land, and follow every league you are in on one leaderboard — now with a form strip and a full points breakdown per player.

Turn on notifications and we will remind you before a fixture you have not predicted kicks off.
```

---

## App Review Information

| Field | Value |
|---|---|
| **Sign-in required** | Yes |
| **Demo account** | `review@scorersonline.uk` |
| **Password** | `VUZNFJNkyYBngot6BWVl` |
| **Contact** | Your name, phone and `danieljamesscreen@gmail.com` |

### Notes to the reviewer

```
Scorers is a free football score-prediction game. There is no gambling: no stake, no odds, no virtual currency, no prizes and no in-app purchases. Players predict match scorelines for points on a private leaderboard.

LEAGUES ARE PRIVATE. There is no league discovery and no public content — you either create a league or join one with an invite code from a friend. The demo account already has a league ("App Review XI") with predictions on the current gameweek, so Predictions, Results and Leaderboard are all populated when you sign in. You are welcome to create your own league too: Leagues tab -> name it -> pick Premier League. A league you create starts with one member (you), so its leaderboard shows a single row until other people join with your invite code — that is the product working as intended, not an empty state.

ACCOUNT DELETION is on the Leagues tab → "Account & sign out" → Delete account. It is immediate and permanent (guideline 5.1.1(v)). Please do not use it on the demo account.

NOTIFICATIONS are optional. If you allow them, the app registers a push token so we can remind you about a fixture you have not predicted before it kicks off. Nothing else is sent.

Fixtures and results come from football-data.org and are confirmed by us centrally; the app itself is read-only in that respect.
```

### The review account — done (2026-09-04)

Created on **production**, not the local database:

1. `review@scorersonline.uk` / `VUZNFJNkyYBngot6BWVl`, display name "App Review".
   Paste both into App Store Connect's demo-account fields.
2. Its own league, **App Review XI** (Premier League, invite code `N6ZTG5`), created
   from the account rather than joining a real one — a reviewer should not be dropped
   into a live competition where they can see real players' picks.
3. Eight predictions on the open gameweek (Matchweek 3), one of them a banker.

With the league attached the account sees 20 open fixtures, 40 kicked off and 20
settled, so no screen is empty — the usual cause of rejection here.

**Known thinness:** the account is alone in its league, so every fixture card shows no
league-mate picks and the leaderboard is a single row of zeros. The reviewer therefore
never sees the head-to-head comparison that is the point of the game. If that matters,
the fix is a production demo league seeded with a few extra players and some settled
history, and pointing the demo account at that instead.

---

## Privacy — App Store Connect "App Privacy" answers

Answer **"Yes, we collect data from this app."** Then declare exactly these, and
nothing else. Every one is **linked to the user** and **not used for tracking**.

| Data type | Category | Purpose | Linked | Tracking |
|---|---|---|---|---|
| Email address | Contact Info | App Functionality | Yes | No |
| Name (display name) | Contact Info | App Functionality | Yes | No |
| User ID | Identifiers | App Functionality | Yes | No |
| Other User Content (predictions) | User Content | App Functionality | Yes | No |
| Device ID (Expo push token) | Identifiers | App Functionality | Yes | No |

Declare **no** advertising data, **no** usage data, **no** diagnostics, **no**
location, **no** contacts, **no** purchases, and **no** third-party analytics.
There is no ad SDK or analytics SDK in the binary, so `NSUserTrackingUsageDescription`
and the App Tracking Transparency prompt are not required.

These answers must match `https://scorersonline.uk/privacy`. If one changes,
change both.

---

## Permission strings

Set in `apps/mobile/app.json` under `expo.ios.infoPlist` when the plugin needs them.

| Permission | String |
|---|---|
| Notifications | `Scorers sends reminders when fixtures you have not predicted are about to kick off.` |

No other permission is requested. The app does not use the camera, microphone,
photo library, contacts, location, calendar, Bluetooth or the local network.

---

## Export compliance

`ITSAppUsesNonExemptEncryption` is already `false` in `app.json`. The app uses
HTTPS only, via the OS. No CCATS or year-end self-classification report needed.

---

## Screenshots

Required: the **6.9" iPhone** set (1290 × 2796). Apple scales that set down for
every other iPhone size, so one set is enough — supply the 6.5" set too only if
you want different crops.

Because `supportsTablet: true` is set in `app.json`, App Store Connect will also
require an **iPad 13"** set (2064 × 2752). If you would rather not produce those,
set `supportsTablet` to `false` and ship iPhone-only for 1.0.

Files live in `store-assets/promo/` (framed, captioned — upload these) with the
raw app captures in `store-assets/screens/`.

| # | Caption | Screen |
|---|---|---|
| 1 | Predict every scoreline | Predictions, open gameweek |
| 2 | Double down with your Banker | Predictions with the banker set |
| 3 | See how close you got | Results, with points and an exact score |
| 4 | One table, all your leagues | Leaderboard |
| 5 | Private leagues, one invite link | Leagues |
| 6 | Looks right at night, too | Predictions in dark mode |
