-- Add legacy mapping fields to User
ALTER TABLE "User" ADD COLUMN "legacySource" TEXT;
ALTER TABLE "User" ADD COLUMN "legacyUserId" TEXT;
ALTER TABLE "User" ADD COLUMN "legacyUsername" TEXT;
ALTER TABLE "User" ADD COLUMN "legacyMetadata" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_legacySource_legacyUserId_key" ON "User"("legacySource", "legacyUserId");
