# Store release checklist (Phase 5)

Native store submission is **blocked on developer accounts**, not on code. Use this
checklist when you are ready to ship TestFlight / Play internal, then public release.

Bundle id / application id: **`uk.scorersonline.app`**  
Deep link scheme: **`scorers://`** (invite: `scorers://join?code=ABCDEF`)  
Default API: `https://scorersonline.uk`

## Accounts & tooling (you)

- [ ] Apple Developer Program membership (paid)
- [ ] Google Play Console account (paid one-time)
- [ ] Install EAS CLI: `npm i -g eas-cli`, then `eas login`
- [ ] In `apps/mobile`, run `eas init` and replace `extra.eas.projectId` in `app.json`
- [ ] Create iOS + Android credentials via `eas build` (or Expo dashboard)

## Builds

```bash
cd apps/mobile
eas build --platform ios --profile preview    # TestFlight / internal
eas build --platform android --profile preview
eas build --platform all --profile production  # store binaries
```

Add `eas.json` profiles when you first run `eas build` (Expo will offer to create one).

## App Store Connect

- [ ] App name: **Scorers**
- [ ] Subtitle: football score predictions for friends
- [ ] Category: Sports (Games / Sports optional secondary)
- [ ] Privacy Policy URL: `https://scorersonline.uk/rules` for now, or a dedicated page later
- [ ] Support URL: `https://scorersonline.uk`
- [ ] Age rating: 4+ (no unrestricted web, no gambling)
- [ ] Screenshots: iPhone 6.7" + 6.1" ( Predictions, Leaderboard, Leagues )
- [ ] Review notes: private leagues via invite; demo account if reviewers need one

### Privacy nutrition labels (typical)

| Data | Linked to user? | Tracking? | Purpose |
|------|-----------------|-----------|---------|
| Email, name | Yes | No | Account |
| Product interaction (predictions) | Yes | No | App functionality |
| Device ID / push token | Yes | No | Notifications |

No advertising SDK. No third-party analytics in v1.

## Google Play

- [ ] Store listing title: Scorers
- [ ] Short description (~80 chars)
- [ ] Full description (predict scores, leagues, banker, provisional points)
- [ ] Feature graphic + phone screenshots
- [ ] Content rating questionnaire (Everyone)
- [ ] Data safety form — mirror the Apple labels above
- [ ] Target API level per current Play requirements

## Permissions copy

- **Notifications** — “Scorers sends reminders when fixtures you have not predicted are about to kick off.”

## After first store build

1. Internal testing (TestFlight + Play internal track) with your league
2. Confirm push reminders on a physical device (Expo Go is limited; use a dev/preview build)
3. Confirm invite deep link opens join/register
4. Then promote to production

## Out of agent scope

Submitting binaries, paying fees, and clicking “Submit for Review” require your Apple/Google
login. The app code and this checklist are ready once EAS project id + accounts exist.
