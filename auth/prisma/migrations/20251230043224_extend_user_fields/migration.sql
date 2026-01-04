-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loginId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "emails" TEXT,
    "phones" TEXT,
    "name" TEXT,
    "gender" TEXT,
    "dob" DATETIME,
    "locations" TEXT,
    "pronouns" TEXT,
    "bio" TEXT,
    "website" TEXT,
    "tosAgreement" BOOLEAN NOT NULL DEFAULT false,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_loginId_key" ON "User"("loginId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
