-- The native app gets its own SubmitVia value; until now it saved picks as API,
-- indistinguishable from the bot API. The backfill is a separate migration
-- because Postgres can't use a new enum value in the transaction that adds it.
ALTER TYPE "SubmitVia" ADD VALUE 'APP';
