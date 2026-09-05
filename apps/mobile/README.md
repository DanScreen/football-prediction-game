# Scorers mobile (Expo)

iOS + Android client for Scorers. Talks to `/api/mobile/v1` — see
[`docs/mobile.md`](../../docs/mobile.md). Store submission checklist:
[`docs/store-release.md`](../../docs/store-release.md).

## Run

```bash
cd apps/mobile
npm start
```

### API URL

Defaults to `https://scorersonline.uk`. For a local Next server:

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000 npm start          # iOS sim
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 npm start         # Android emu
```

## Features

| Area | Status |
|------|--------|
| Login / register / forgot-password | ✅ |
| Predictions + banker | ✅ |
| Stacked leaderboards | ✅ |
| Create / join / share leagues | ✅ |
| Rules from API | ✅ |
| Push deadline reminders | ✅ (needs device build + EAS project id) |
| Invite deep link `scorers://join?code=` | ✅ |
| On-device testing | Expo Go works (`npm run start:go`) — see below |

## Testing on a physical phone

**Expo Go works.** App Store Expo Go ships SDK 57, which is what this project
targets, so no Apple Developer membership is needed to try the app on a phone:

```bash
cd apps/mobile
npm run start:go            # note: --go, not the default dev-client mode
```

Install **Expo Go** from the App Store / Play Store, put the phone on the same
Wi-Fi as the Mac, then scan the QR code in the terminal (or enter the
`exp://<lan-ip>:8081` URL by hand). Signing into Expo Go with the same account as
the CLI (`danscreen`) also makes the server appear under **Projects**.

The app talks to production (`https://scorersonline.uk`) by default; set
`EXPO_PUBLIC_API_URL` to point it at a local Next server instead.

Two things do **not** work under Expo Go, by design — they need a native build:

- **Push reminders.** Expo Go dropped remote push notifications, so the
  registration call in `lib/notifications.ts` throws. It is caught and ignored,
  so the app runs fine and simply never receives a deadline reminder.
- **The `scorers://join?code=` deep link.** Expo Go owns the URL scheme, so
  invite links open the website rather than the app.

For those two, and for anything that has to behave exactly like the shipped
binary, use an EAS development build — see
[store-release.md](../../docs/store-release.md).


## Scripts

| Command | Purpose |
|---------|---------|
| `npm start` | Expo dev server (dev-client mode) |
| `npm run start:go` | Expo dev server for **Expo Go** on a phone |
| `npm run typecheck` | `tsc --noEmit` |
