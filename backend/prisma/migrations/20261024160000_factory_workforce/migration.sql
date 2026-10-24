-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'WORKER');

-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'NEEDS_IMPROVEMENT', 'PASSED', 'APPROVED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "CompetencyStatus" AS ENUM ('IN_TRAINING', 'PENDING_REVIEW', 'VERIFIED', 'NEEDS_REASSESSMENT');

-- AlterTable
ALTER TABLE "TrainingProject" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "TrainingSession" ADD COLUMN     "assignmentId" TEXT;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "employeeId" VARCHAR(80) NOT NULL,
    "fullName" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "department" VARCHAR(100) NOT NULL DEFAULT '',
    "status" "WorkerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerInvitation" (
    "id" TEXT NOT NULL,
    "workerProfileId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" VARCHAR(80) NOT NULL,
    "subjectType" VARCHAR(80) NOT NULL,
    "subjectId" VARCHAR(80) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workerProfileId" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "dueAt" TIMESTAMP(3),
    "requiresOwnerApproval" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competency" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "reassessmentDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyRequirement" (
    "id" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CompetencyRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerCompetency" (
    "id" TEXT NOT NULL,
    "workerProfileId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "status" "CompetencyStatus" NOT NULL DEFAULT 'IN_TRAINING',
    "approvedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "reassessAt" TIMESTAMP(3),
    "feedback" VARCHAR(2000) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerCompetency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingAssignmentCompetency" (
    "assignmentId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,

    CONSTRAINT "TrainingAssignmentCompetency_pkey" PRIMARY KEY ("assignmentId","competencyId")
);

-- CreateIndex
CREATE INDEX "Organization_createdAt_idx" ON "Organization"("createdAt");

-- CreateIndex
CREATE INDEX "OrganizationMembership_userId_role_idx" ON "OrganizationMembership"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "WorkerProfile_organizationId_status_fullName_idx" ON "WorkerProfile"("organizationId", "status", "fullName");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerProfile_organizationId_employeeId_key" ON "WorkerProfile"("organizationId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerProfile_organizationId_email_key" ON "WorkerProfile"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerProfile_organizationId_userId_key" ON "WorkerProfile"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerInvitation_workerProfileId_key" ON "WorkerInvitation"("workerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerInvitation_tokenHash_key" ON "WorkerInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "WorkerInvitation_expiresAt_acceptedAt_idx" ON "WorkerInvitation"("expiresAt", "acceptedAt");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_subjectType_subjectId_idx" ON "AuditEvent"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "TrainingAssignment_organizationId_status_dueAt_idx" ON "TrainingAssignment"("organizationId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "TrainingAssignment_workerProfileId_status_dueAt_idx" ON "TrainingAssignment"("workerProfileId", "status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingAssignment_workerProfileId_trainingId_key" ON "TrainingAssignment"("workerProfileId", "trainingId");

-- CreateIndex
CREATE INDEX "Competency_organizationId_updatedAt_idx" ON "Competency"("organizationId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Competency_organizationId_name_key" ON "Competency"("organizationId", "name");

-- CreateIndex
CREATE INDEX "CompetencyRequirement_stepId_idx" ON "CompetencyRequirement"("stepId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyRequirement_competencyId_stepId_key" ON "CompetencyRequirement"("competencyId", "stepId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyRequirement_competencyId_position_key" ON "CompetencyRequirement"("competencyId", "position");

-- CreateIndex
CREATE INDEX "WorkerCompetency_workerProfileId_status_reassessAt_idx" ON "WorkerCompetency"("workerProfileId", "status", "reassessAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerCompetency_workerProfileId_competencyId_key" ON "WorkerCompetency"("workerProfileId", "competencyId");

-- CreateIndex
CREATE INDEX "TrainingAssignmentCompetency_competencyId_idx" ON "TrainingAssignmentCompetency"("competencyId");

-- CreateIndex
CREATE INDEX "TrainingProject_organizationId_updatedAt_idx" ON "TrainingProject"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "TrainingSession_assignmentId_idx" ON "TrainingSession"("assignmentId");

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerProfile" ADD CONSTRAINT "WorkerProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerProfile" ADD CONSTRAINT "WorkerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerInvitation" ADD CONSTRAINT "WorkerInvitation_workerProfileId_fkey" FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingProject" ADD CONSTRAINT "TrainingProject_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TrainingAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_workerProfileId_fkey" FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "TrainingProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAssignment" ADD CONSTRAINT "TrainingAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competency" ADD CONSTRAINT "Competency_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competency" ADD CONSTRAINT "Competency_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "TrainingProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyRequirement" ADD CONSTRAINT "CompetencyRequirement_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyRequirement" ADD CONSTRAINT "CompetencyRequirement_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "TrainingStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerCompetency" ADD CONSTRAINT "WorkerCompetency_workerProfileId_fkey" FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerCompetency" ADD CONSTRAINT "WorkerCompetency_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerCompetency" ADD CONSTRAINT "WorkerCompetency_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAssignmentCompetency" ADD CONSTRAINT "TrainingAssignmentCompetency_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TrainingAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAssignmentCompetency" ADD CONSTRAINT "TrainingAssignmentCompetency_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
