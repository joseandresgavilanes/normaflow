-- CreateTable
CREATE TABLE "nonconformity_comments" (
    "id" TEXT NOT NULL,
    "nonconformityId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nonconformity_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nonconformity_comments_nonconformityId_createdAt_idx" ON "nonconformity_comments"("nonconformityId", "createdAt");

-- AddForeignKey
ALTER TABLE "nonconformity_comments" ADD CONSTRAINT "nonconformity_comments_nonconformityId_fkey" FOREIGN KEY ("nonconformityId") REFERENCES "nonconformities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
