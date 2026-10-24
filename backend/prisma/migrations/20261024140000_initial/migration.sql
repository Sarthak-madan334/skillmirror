-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'INSTRUCTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TrainingSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'PAUSED');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('SUBMITTED', 'NEEDS_REVIEW', 'NEEDS_IMPROVEMENT', 'PASSED', 'UNABLE_TO_VERIFY');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('READY');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingProject" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "level" VARCHAR(40) NOT NULL,
    "duration" INTEGER NOT NULL,
    "objectives" VARCHAR(500) NOT NULL DEFAULT '',
    "materials" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "TrainingStatus" NOT NULL DEFAULT 'DRAFT',
    "source" VARCHAR(40) NOT NULL DEFAULT 'user',
    "demonstration" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingStep" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "instructions" VARCHAR(2000) NOT NULL,
    "position" INTEGER NOT NULL,
    "expected" VARCHAR(1000) NOT NULL DEFAULT '',
    "verification" VARCHAR(1000) NOT NULL DEFAULT '',
    "safety" VARCHAR(1000) NOT NULL DEFAULT '',
    "image" VARCHAR(2048) NOT NULL DEFAULT '',
    "feedback" VARCHAR(1000) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "projectId" TEXT,
    "sessionId" TEXT,
    "stepId" TEXT,
    "attemptId" TEXT,
    "originalName" VARCHAR(255) NOT NULL,
    "storageKey" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(120) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'READY',
    "provider" "StorageProvider" NOT NULL DEFAULT 'LOCAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "currentPosition" INTEGER NOT NULL DEFAULT 0,
    "status" "TrainingSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepAttempt" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "verificationStatus" "AttemptStatus" NOT NULL DEFAULT 'SUBMITTED',
    "feedback" VARCHAR(2000) NOT NULL DEFAULT '',
    "verificationMethod" VARCHAR(60) NOT NULL DEFAULT 'HUMAN_REVIEW',
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "StepAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentReport" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "totalSteps" INTEGER NOT NULL,
    "attemptedSteps" INTEGER NOT NULL,
    "passedSteps" INTEGER NOT NULL,
    "stepsNeedingImprovement" INTEGER NOT NULL,
    "completionPercentage" INTEGER NOT NULL,
    "recommendations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assessmentMethod" VARCHAR(80) NOT NULL DEFAULT 'RECORDED_ATTEMPTS',
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "TrainingProject_ownerId_updatedAt_idx" ON "TrainingProject"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "TrainingProject_status_updatedAt_idx" ON "TrainingProject"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "TrainingStep_projectId_position_idx" ON "TrainingStep"("projectId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingStep_projectId_position_key" ON "TrainingStep"("projectId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "MediaAsset_ownerId_createdAt_idx" ON "MediaAsset"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_projectId_idx" ON "MediaAsset"("projectId");

-- CreateIndex
CREATE INDEX "MediaAsset_sessionId_idx" ON "MediaAsset"("sessionId");

-- CreateIndex
CREATE INDEX "TrainingSession_learnerId_status_updatedAt_idx" ON "TrainingSession"("learnerId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "TrainingSession_projectId_startedAt_idx" ON "TrainingSession"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "StepAttempt_sessionId_submittedAt_idx" ON "StepAttempt"("sessionId", "submittedAt");

-- CreateIndex
CREATE INDEX "StepAttempt_stepId_verificationStatus_idx" ON "StepAttempt"("stepId", "verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "StepAttempt_sessionId_stepId_attemptNumber_key" ON "StepAttempt"("sessionId", "stepId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentReport_sessionId_key" ON "AssessmentReport"("sessionId");

-- CreateIndex
CREATE INDEX "AssessmentReport_createdAt_idx" ON "AssessmentReport"("createdAt");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingProject" ADD CONSTRAINT "TrainingProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingStep" ADD CONSTRAINT "TrainingStep_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TrainingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TrainingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "TrainingStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "StepAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TrainingProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepAttempt" ADD CONSTRAINT "StepAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepAttempt" ADD CONSTRAINT "StepAttempt_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "TrainingStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentReport" ADD CONSTRAINT "AssessmentReport_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
