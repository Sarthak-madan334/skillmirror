import type { PrismaClient, TrainingProject } from '../../generated/client/client.js';
import { HttpError } from '../errors.js';

export async function findReadableTraining(prisma: PrismaClient, trainingId: string, userId: string) {
  const project = await prisma.trainingProject.findUnique({ where: { id: trainingId } });
  if (!project) throw new HttpError(404, 'NOT_FOUND', 'Training was not found.');
  if (!project.organizationId) {
    if (project.ownerId === userId || project.status === 'PUBLISHED') return project;
    throw new HttpError(404, 'NOT_FOUND', 'Training was not found.');
  }

  const membership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId: project.organizationId, userId } },
    select: { role: true },
  });
  if (membership?.role === 'OWNER') return project;
  const assignedWorker = membership?.role === 'WORKER' && project.status === 'PUBLISHED'
    ? await prisma.workerProfile.findFirst({
      where: { organizationId: project.organizationId, userId, status: 'ACTIVE', assignments: { some: { trainingId: project.id } } },
      select: { id: true },
    })
    : null;
  if (!assignedWorker) throw new HttpError(404, 'NOT_FOUND', 'Training was not found.');
  return project;
}

export function assertProjectOwner(project: Pick<TrainingProject, 'ownerId'>, userId: string): void {
  if (project.ownerId !== userId) throw new HttpError(404, 'NOT_FOUND', 'Training was not found.');
}

export async function findOwnedTraining(prisma: PrismaClient, trainingId: string, userId: string) {
  const project = await prisma.trainingProject.findUnique({ where: { id: trainingId } });
  if (!project) throw new HttpError(404, 'NOT_FOUND', 'Training was not found.');
  if (!project.organizationId && project.ownerId === userId) return project;
  if (project.organizationId) {
    const membership = await prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId: project.organizationId, userId } },
      select: { role: true },
    });
    if (membership?.role === 'OWNER') return project;
  }
  throw new HttpError(404, 'NOT_FOUND', 'Training was not found.');
}

export async function requireOwnerOrganization(prisma: PrismaClient, organizationId: string, userId: string) {
  const membership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    include: { organization: true },
  });
  if (!membership || membership.role !== 'OWNER') throw new HttpError(404, 'NOT_FOUND', 'Organization was not found.');
  return membership.organization;
}

export async function findWorkerProfile(prisma: PrismaClient, organizationId: string, userId: string) {
  const membership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true },
  });
  if (membership?.role !== 'WORKER') throw new HttpError(404, 'NOT_FOUND', 'Worker assignment was not found.');
  const worker = await prisma.workerProfile.findFirst({ where: { organizationId, userId, status: 'ACTIVE' } });
  if (!worker) throw new HttpError(404, 'NOT_FOUND', 'Worker assignment was not found.');
  return worker;
}

export async function findSessionAccess(prisma: PrismaClient, sessionId: string, userId: string) {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: { project: { select: { id: true, ownerId: true, organizationId: true, title: true, status: true } } },
  });
  let ownerAccess = !session?.project.organizationId && session?.project.ownerId === userId;
  if (session?.project.organizationId) {
    const membership = await prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId: session.project.organizationId, userId } },
      select: { role: true },
    });
    ownerAccess = membership?.role === 'OWNER';
  }
  if (!session || (session.learnerId !== userId && !ownerAccess)) {
    throw new HttpError(404, 'NOT_FOUND', 'Training session was not found.');
  }
  return session;
}

export function assertStepIdSet(requestedIds: string[], existingIds: string[]): void {
  if (requestedIds.length !== existingIds.length || new Set(requestedIds).size !== requestedIds.length) {
    throw new HttpError(400, 'INVALID_STEP_ORDER', 'Provide every step ID exactly once.');
  }
  const existing = new Set(existingIds);
  if (requestedIds.some((id) => !existing.has(id))) {
    throw new HttpError(400, 'INVALID_STEP_ORDER', 'The requested order contains an unknown step ID.');
  }
}