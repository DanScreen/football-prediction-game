-- CreateTable
CREATE TABLE "UserActivityDay" (
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "web" BOOLEAN NOT NULL DEFAULT false,
    "app" BOOLEAN NOT NULL DEFAULT false,
    "api" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserActivityDay_pkey" PRIMARY KEY ("userId","day")
);

-- CreateIndex
CREATE INDEX "UserActivityDay_day_idx" ON "UserActivityDay"("day");

-- AddForeignKey
ALTER TABLE "UserActivityDay" ADD CONSTRAINT "UserActivityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: reconstruct past active days from what the database already records,
-- so return-frequency and retention have history from day one. Days are
-- Europe/London calendar days (timestamps are stored as UTC without a zone).
-- Surfaces come from the pick's submittedVia (WEB / APP / API, relabelled by the
-- previous migration). Sign-up, league joins and lastSeenAt mark the day
-- without a surface. `updatedAt` counts only
-- before kickoff: after it, the row is touched by result scoring, not the player.
INSERT INTO "UserActivityDay" ("userId", "day", "web", "app", "api")
SELECT "userId", "day", bool_or("web"), bool_or("app"), bool_or("api")
FROM (
    SELECT p."userId",
           (ts AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London')::date AS "day",
           p."submittedVia" = 'WEB' AS "web",
           p."submittedVia" = 'APP' AS "app",
           p."submittedVia" = 'API' AS "api"
    FROM "Prediction" p
    JOIN "Fixture" f ON f."id" = p."fixtureId"
    CROSS JOIN LATERAL (VALUES (p."createdAt"), (p."updatedAt")) AS t(ts)
    WHERE ts < f."kickoffTime"
    UNION ALL
    SELECT "id", ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London')::date, false, false, false
    FROM "User"
    UNION ALL
    SELECT "id", ("lastSeenAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London')::date, false, false, false
    FROM "User" WHERE "lastSeenAt" IS NOT NULL
    UNION ALL
    SELECT "userId", ("joinedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London')::date, false, false, false
    FROM "LeagueMembership"
) AS activity
GROUP BY "userId", "day";
