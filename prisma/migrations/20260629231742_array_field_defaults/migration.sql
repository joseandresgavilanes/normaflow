-- AlterTable
ALTER TABLE "documents" ALTER COLUMN "tags" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "distributionList" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "management_reviews" ALTER COLUMN "attendees" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "processes" ALTER COLUMN "inputs" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "outputs" SET DEFAULT ARRAY[]::TEXT[];
