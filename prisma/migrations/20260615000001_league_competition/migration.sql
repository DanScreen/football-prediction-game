-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_League" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "competition" TEXT NOT NULL DEFAULT '',
    "inviteCode" TEXT NOT NULL,
    "grandSlamEnabled" BOOLEAN NOT NULL DEFAULT false,
    "grandSlamPoints" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_League" ("createdAt", "grandSlamEnabled", "grandSlamPoints", "id", "inviteCode", "name") SELECT "createdAt", "grandSlamEnabled", "grandSlamPoints", "id", "inviteCode", "name" FROM "League";
DROP TABLE "League";
ALTER TABLE "new_League" RENAME TO "League";
CREATE UNIQUE INDEX "League_inviteCode_key" ON "League"("inviteCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

