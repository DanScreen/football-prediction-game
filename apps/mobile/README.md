# Scorers mobile (Expo)

Phase 2 skeleton for iOS + Android. Talks to the web app's `/api/mobile/v1` API
(see [`docs/mobile.md`](../../docs/mobile.md)).

## Run

```bash
cd apps/mobile
npm start
```

Then press `i` / `a` for simulator, or scan the QR with Expo Go.

### API URL

Defaults to `https://scorersonline.uk`. For a local Next server:

```bash
# iOS simulator
EXPO_PUBLIC_API_URL=http://localhost:3000 npm start

# Android emulator
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 npm start
```

On a physical device, use your machine's LAN IP (and ensure the Next server listens
on `0.0.0.0`).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm start` | Expo dev server |
| `npm run typecheck` | `tsc --noEmit` |

## Layout

- `app/(auth)` — login / register
- `app/(tabs)` — Predictions, Leaderboard, Leagues, Rules (placeholders until Phase 3)
- `lib/api.ts` — fetch client with refresh rotation
- `lib/auth.tsx` — session + SecureStore
- `constants/tokens.ts` — Quiet Product colours
