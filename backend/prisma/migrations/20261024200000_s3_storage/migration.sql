ALTER TYPE "StorageProvider" ADD VALUE 'S3';

CREATE INDEX "MediaAsset_createdAt_idx" ON "MediaAsset"("createdAt");
