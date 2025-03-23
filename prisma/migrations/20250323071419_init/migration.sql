-- CreateTable
CREATE TABLE "UserIndexPrefs" (
    "userId" UUID NOT NULL,
    "config" JSONB NOT NULL,
    "pgCreds" BYTEA,
    "webhookId" TEXT NOT NULL,

    CONSTRAINT "UserIndexPrefs_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserIndexPrefs_webhookId_key" ON "UserIndexPrefs"("webhookId");
