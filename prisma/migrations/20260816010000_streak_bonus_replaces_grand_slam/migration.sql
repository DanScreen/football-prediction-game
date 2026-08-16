-- The tiered streak bonus replaces the all-or-nothing Grand Slam, and applies in
-- every league, so the per-league configuration has nothing left to configure.
--
-- DESTRUCTIVE: drops each league's stored Grand Slam settings. They are dead
-- config under the new rules, and `grandSlamEnabled` defaulted to false.
--
-- Existing BonusAward rows are deliberately left alone: they are a historical
-- record of what was awarded at the time, and deleting them would silently take
-- points off past rounds. New awards use the streak tiers from the next
-- confirmed gameweek onwards.
ALTER TABLE "League" DROP COLUMN "grandSlamEnabled",
DROP COLUMN "grandSlamPoints";
