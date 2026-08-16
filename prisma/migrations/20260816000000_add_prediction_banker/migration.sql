-- Banker: one fixture per gameweek whose points are doubled.
-- Additive and defaulted, so existing predictions are unaffected.
ALTER TABLE "Prediction" ADD COLUMN "isBanker" BOOLEAN NOT NULL DEFAULT false;
