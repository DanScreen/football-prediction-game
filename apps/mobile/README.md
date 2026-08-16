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
| Push deadline reminders | ✅ (needs EAS project id + physical device build) |
| Invite deep link `scorers://join?code=` | ✅ |

## Scripts

| Command | Purpose |
|---------|---------|
| `npm start` | Expo dev server |
| `npm run typecheck` | `tsc --noEmit` |
