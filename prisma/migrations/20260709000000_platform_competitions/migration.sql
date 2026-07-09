-- Platform-owned competitions refactor.
--
-- Fixtures and results move from being owned per-league to being owned by a
-- shared Competition that leagues subscribe to. Predictions, bonus awards and
-- fixtures are all rebuilt from the new canonical model, so we clear them here
-- (the app has no production data worth preserving). Existing leagues are kept
-- and re-pointed at the Competition matching their old `competition` name; any
-- league naming a competition we don't host is removed.

-- 1. Clear the old per-league fixture/result data --------------------------
DELETE FROM "Prediction";
DELETE FROM "BonusAward";
DELETE FROM "Fixture";

-- 2. Competition table ------------------------------------------------------
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "flag" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Competition_name_key" ON "Competition"("name");

-- Seed the initial platform competitions (mirrors app/leagues/data.ts). These
-- must exist before we backfill League.competitionId below.
INSERT INTO "Competition" ("id", "name", "code", "flag") VALUES
  (gen_random_uuid()::text, 'Premier League', 'PL', '🏴󠁧󠁢󠁥󠁮󠁧󠁿'),
  (gen_random_uuid()::text, 'FIFA World Cup 2026', 'WC', '🌍');

-- 3. Host role --------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN "isSiteAdmin" BOOLEAN NOT NULL DEFAULT false;

-- 4. Re-point leagues at their Competition ----------------------------------
ALTER TABLE "League" ADD COLUMN "competitionId" TEXT;

UPDATE "League" l
   SET "competitionId" = c."id"
  FROM "Competition" c
 WHERE c."name" = l."competition";

-- Drop leagues (and their memberships) referencing a competition we don't host.
-- Predictions and bonus awards were already cleared above.
DELETE FROM "LeagueMembership"
 WHERE "leagueId" IN (SELECT "id" FROM "League" WHERE "competitionId" IS NULL);
DELETE FROM "League" WHERE "competitionId" IS NULL;

ALTER TABLE "League" ALTER COLUMN "competitionId" SET NOT NULL;
ALTER TABLE "League" DROP COLUMN "competition";

-- 5. Fixtures become competition-owned --------------------------------------
ALTER TABLE "Fixture" DROP CONSTRAINT "Fixture_leagueId_fkey";
ALTER TABLE "Fixture" DROP COLUMN "competition",
                      DROP COLUMN "leagueId",
                      ADD COLUMN "competitionId" TEXT NOT NULL;

CREATE UNIQUE INDEX "Fixture_competitionId_homeTeam_awayTeam_kickoffTime_key"
    ON "Fixture"("competitionId", "homeTeam", "awayTeam", "kickoffTime");

-- 6. BonusAward drops its competition column (round is unique within a league)
DROP INDEX "BonusAward_userId_leagueId_competition_round_key";
ALTER TABLE "BonusAward" DROP COLUMN "competition";
CREATE UNIQUE INDEX "BonusAward_userId_leagueId_round_key"
    ON "BonusAward"("userId", "leagueId", "round");

-- 7. Foreign keys -----------------------------------------------------------
ALTER TABLE "League" ADD CONSTRAINT "League_competitionId_fkey"
    FOREIGN KEY ("competitionId") REFERENCES "Competition"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_competitionId_fkey"
    FOREIGN KEY ("competitionId") REFERENCES "Competition"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
