-- CreateTable
CREATE TABLE "MobileDeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expoPushToken" TEXT NOT NULL,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileDeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MobileDeviceToken_expoPushToken_key" ON "MobileDeviceToken"("expoPushToken");

-- CreateIndex
CREATE INDEX "MobileDeviceToken_userId_idx" ON "MobileDeviceToken"("userId");

-- AddForeignKey
ALTER TABLE "MobileDeviceToken" ADD CONSTRAINT "MobileDeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
