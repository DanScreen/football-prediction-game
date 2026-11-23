-- Relabel past app picks. The app always submitted as API, so an API pick by a
-- human who had already signed in to the app (a MobileRefreshToken row older
-- than the pick — refresh tokens are revoked, never deleted) came from the app.
-- Bot-API accounts never sign in to the app, so their picks stay API.
UPDATE "Prediction" p
SET "submittedVia" = 'APP'
WHERE p."submittedVia" = 'API'
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = p."userId" AND u."isBot")
  AND EXISTS (
    SELECT 1 FROM "MobileRefreshToken" t
    WHERE t."userId" = p."userId" AND t."createdAt" <= p."createdAt"
  );
