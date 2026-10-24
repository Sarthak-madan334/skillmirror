import { createHash, randomBytes } from 'node:crypto';
import { Prisma, type PrismaClient } from '../../generated/client/client.js';
import { Router } from 'express';
import { requireAuth, type AuthUser } from '../auth.js';
import { assertFound, HttpError } from '../errors.js';
import {
  acceptWorkerInvitationSchema,
  approveCompetencySchema,
  createAssignmentSchema,
  createCompetencySchema,
  createOrganizationSchema,
  createWorkerSchema,
  listWorkersSchema,
  ownerTrainingSchema,
  ownerReportQuerySchema,
  routeIdSchema,
} from '../schemas.js';
import { findWorkerProfile, requireOwnerOrganization } from '../services/access.js';
import { sendData } from '../utils/response.js';

const trainingInclude = { steps: { orderBy: { position: 'asc' as const } } };

function toClientTraining<T extends { status: string }>(training: T) {
  return { ...training, status: training.status.toLowerCase() };
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function auditData(input: { organizationId: string; actorUserId: string; action: string; subjectType: string; subjectId: string; metadata?: Prisma.InputJsonValue }) {
  return {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: input.action,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

export function createFactoryRouter(prisma: PrismaClient): Router {
  const router = Router();
  router.use(requireAuth(prisma));

  router.get('/owner/organizations', async (_request, response) => {
    const user = response.locals.user as AuthUser;
    const memberships = await prisma.organizationMembership.findMany({
      where: { userId: user.id, role: 'OWNER' },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });
    sendData(response, { organizations: memberships.map(({ organization }) => organization) });
  });

  router.post('/owner/organizations', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const input = createOrganizationSchema.parse(request.body);
    const organization = await prisma.$transaction(async (transaction) => {
      const created = await transaction.organization.create({ data: { name: input.name } });
      await transaction.organizationMembership.create({ data: { organizationId: created.id, userId: user.id, role: 'OWNER' } });
      await transaction.auditEvent.create({ data: auditData({ organizationId: created.id, actorUserId: user.id, action: 'ORGANIZATION_CREATED', subjectType: 'Organization', subjectId: created.id }) });
      return created;
    });
    sendData(response, { organization, membershipRole: 'OWNER' }, 201);
  });

  router.get('/owner/organizations/:organizationId/overview', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: organizationId } = routeIdSchema.parse({ id: request.params.organizationId });
    const organization = await requireOwnerOrganization(prisma, organizationId, user.id);
    const today = new Date();
    const [totalWorkers, trainingInProgress, verifiedCompetencies, pendingAssessments, overdueTraining, recentActivity, attentionRequired] = await Promise.all([
      prisma.workerProfile.count({ where: { organizationId, status: 'ACTIVE' } }),
      prisma.trainingAssignment.count({ where: { organizationId, status: 'IN_PROGRESS' } }),
      prisma.workerCompetency.count({ where: { worker: { organizationId }, status: 'VERIFIED' } }),
      prisma.stepAttempt.count({ where: { verificationStatus: 'NEEDS_REVIEW', session: { project: { organizationId } } } }),
      prisma.trainingAssignment.count({ where: { organizationId, dueAt: { lt: today }, status: { in: ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'NEEDS_IMPROVEMENT'] } } }),
      prisma.auditEvent.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 8 }),
      prisma.stepAttempt.findMany({
        where: { verificationStatus: 'NEEDS_REVIEW', session: { project: { organizationId } } },
        include: { step: { select: { title: true } }, session: { include: { learner: { select: { name: true } }, project: { select: { title: true } } } } },
        orderBy: { submittedAt: 'asc' },
        take: 10,
      }),
    ]);
    sendData(response, { organization, metrics: { totalWorkers, trainingInProgress, verifiedCompetencies, pendingAssessments, overdueTraining }, recentActivity, attentionRequired });
  });

  router.get('/owner/organizations/:organizationId/workers', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const query = listWorkersSchema.parse({ ...request.query, organizationId: request.params.organizationId });
    await requireOwnerOrganization(prisma, query.organizationId, user.id);
    const where: Prisma.WorkerProfileWhereInput = {
      organizationId: query.organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.department ? { department: query.department } : {}),
      ...(query.search ? { OR: [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { employeeId: { contains: query.search, mode: 'insensitive' } },
      ] } : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.workerProfile.findMany({
        where,
        orderBy: { fullName: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          assignments: { include: { training: { select: { id: true, title: true } } }, orderBy: { updatedAt: 'desc' } },
          competencies: { include: { competency: { select: { id: true, name: true } } } },
        },
      }),
      prisma.workerProfile.count({ where }),
    ]);
    sendData(response, { items, page: query.page, pageSize: query.pageSize, total });
  });

  router.post('/owner/organizations/:organizationId/workers', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: organizationId } = routeIdSchema.parse({ id: request.params.organizationId });
    await requireOwnerOrganization(prisma, organizationId, user.id);
    const input = createWorkerSchema.parse({ ...request.body, organizationId });
    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const result = await prisma.$transaction(async (transaction) => {
      const worker = await transaction.workerProfile.create({
        data: {
          organizationId,
          fullName: input.fullName,
          email: input.email.toLowerCase(),
          employeeId: input.employeeId,
          department: input.department,
          invitation: { create: { tokenHash: tokenHash(rawToken), expiresAt } },
        },
      });
      await transaction.auditEvent.create({ data: auditData({ organizationId, actorUserId: user.id, action: 'WORKER_ADDED', subjectType: 'WorkerProfile', subjectId: worker.id }) });
      return worker;
    });
    sendData(response, { worker: result, invitation: { token: rawToken, expiresAt, deliveryStatus: 'NOT_SENT' } }, 201);
  });

  router.get('/owner/organizations/:organizationId/workers/:workerId', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: organizationId } = routeIdSchema.parse({ id: request.params.organizationId });
    const { id: workerId } = routeIdSchema.parse({ id: request.params.workerId });
    await requireOwnerOrganization(prisma, organizationId, user.id);
    const worker = assertFound(await prisma.workerProfile.findFirst({
      where: { id: workerId, organizationId },
      include: {
        assignments: {
          include: { training: { include: { steps: { orderBy: { position: 'asc' } } } }, sessions: { include: { attempts: { include: { step: true, evidence: true }, orderBy: { submittedAt: 'desc' } }, report: true } } },
          orderBy: { assignedAt: 'desc' },
        },
        competencies: { include: { competency: { include: { requirements: { include: { step: true }, orderBy: { position: 'asc' } } } }, approvedBy: { select: { id: true, name: true } } } },
      },
    }), 'Worker was not found.');
    sendData(response, { worker });
  });

  router.post('/owner/organizations/:organizationId/trainings', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: organizationId } = routeIdSchema.parse({ id: request.params.organizationId });
    await requireOwnerOrganization(prisma, organizationId, user.id);
    const input = ownerTrainingSchema.parse({ ...request.body, organizationId });
    if (input.status === 'published' && input.steps.length === 0) throw new HttpError(422, 'INCOMPLETE_TRAINING', 'Add steps before publishing this training.');
    const training = await prisma.$transaction(async (transaction) => {
      const created = await transaction.trainingProject.create({
        data: {
          ownerId: user.id,
          organizationId,
          title: input.title,
          description: input.description,
          category: input.category,
          level: input.level,
          duration: input.duration,
          objectives: input.objectives,
          materials: input.materials,
          status: input.status === 'published' ? 'PUBLISHED' : 'DRAFT',
          demonstration: input.demonstration ? input.demonstration : Prisma.JsonNull,
          steps: { create: input.steps.map((step, position) => ({ ...step, position })) },
        },
        include: trainingInclude,
      });
      await transaction.auditEvent.create({ data: auditData({ organizationId, actorUserId: user.id, action: 'TRAINING_ASSIGNED', subjectType: 'TrainingProject', subjectId: created.id }) });
      return created;
    });
    sendData(response, toClientTraining(training), 201);
  });

  router.get('/owner/organizations/:organizationId/trainings', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: organizationId } = routeIdSchema.parse({ id: request.params.organizationId });
    await requireOwnerOrganization(prisma, organizationId, user.id);
    const trainings = await prisma.trainingProject.findMany({ where: { organizationId }, include: trainingInclude, orderBy: { updatedAt: 'desc' } });
    sendData(response, { items: trainings.map(toClientTraining) });
  });

  router.post('/owner/organizations/:organizationId/competencies', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: organizationId } = routeIdSchema.parse({ id: request.params.organizationId });
    await requireOwnerOrganization(prisma, organizationId, user.id);
    const input = createCompetencySchema.parse({ ...request.body, organizationId });
    const training = assertFound(await prisma.trainingProject.findFirst({ where: { id: input.trainingId, organizationId }, include: { steps: { select: { id: true } } } }), 'Training was not found.');
    const actualSteps = new Set(training.steps.map((step) => step.id));
    if (input.requiredStepIds.some((id) => !actualSteps.has(id))) throw new HttpError(400, 'INVALID_COMPETENCY_STEPS', 'Every competency requirement must reference a step in its training.');
    const competency = await prisma.$transaction(async (transaction) => {
      const created = await transaction.competency.create({
        data: {
          organizationId,
          trainingId: input.trainingId,
          name: input.name,
          description: input.description,
          reassessmentDays: input.reassessmentDays,
          requirements: { create: input.requiredStepIds.map((stepId, position) => ({ stepId, position })) },
        },
        include: { requirements: { include: { step: true }, orderBy: { position: 'asc' } } },
      });
      await transaction.auditEvent.create({ data: auditData({ organizationId, actorUserId: user.id, action: 'COMPETENCY_CREATED', subjectType: 'Competency', subjectId: created.id }) });
      return created;
    });
    sendData(response, { competency }, 201);
  });

  router.post('/owner/organizations/:organizationId/assignments', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: organizationId } = routeIdSchema.parse({ id: request.params.organizationId });
    await requireOwnerOrganization(prisma, organizationId, user.id);
    const input = createAssignmentSchema.parse({ ...request.body, organizationId });
    const training = assertFound(await prisma.trainingProject.findFirst({ where: { id: input.trainingId, organizationId, status: 'PUBLISHED' }, select: { id: true } }), 'Published training was not found.');
    const workers = await prisma.workerProfile.findMany({ where: { id: { in: input.workerProfileIds }, organizationId, status: 'ACTIVE' }, select: { id: true } });
    if (workers.length !== input.workerProfileIds.length) throw new HttpError(400, 'INVALID_WORKERS', 'All selected active workers must belong to this organization.');
    const competencies = input.competencyIds.length ? await prisma.competency.findMany({ where: { id: { in: input.competencyIds }, organizationId, trainingId: training.id }, select: { id: true } }) : [];
    if (competencies.length !== input.competencyIds.length) throw new HttpError(400, 'INVALID_COMPETENCIES', 'Selected competencies must belong to this organization and training.');
    const created = await prisma.$transaction(async (transaction) => {
      const assignments = [];
      for (const worker of workers) {
        const existing = await transaction.trainingAssignment.findUnique({ where: { workerProfileId_trainingId: { workerProfileId: worker.id, trainingId: training.id } } });
        if (existing) throw new HttpError(409, 'ASSIGNMENT_EXISTS', 'This training is already assigned to one of the selected workers.');
        const assignment = await transaction.trainingAssignment.create({
          data: {
            organizationId,
            workerProfileId: worker.id,
            trainingId: training.id,
            assignedByUserId: user.id,
            dueAt: input.dueAt,
            requiresOwnerApproval: input.requiresOwnerApproval,
            competencies: { create: input.competencyIds.map((competencyId) => ({ competencyId })) },
          },
          include: { worker: true, training: { select: { id: true, title: true } }, competencies: { include: { competency: true } } },
        });
        for (const competencyId of input.competencyIds) {
          await transaction.workerCompetency.upsert({
            where: { workerProfileId_competencyId: { workerProfileId: worker.id, competencyId } },
            create: { workerProfileId: worker.id, competencyId, status: 'IN_TRAINING' },
            update: { status: 'IN_TRAINING', approvedByUserId: null, verifiedAt: null, reassessAt: null },
          });
        }
        await transaction.auditEvent.create({ data: auditData({ organizationId, actorUserId: user.id, action: 'TRAINING_ASSIGNED', subjectType: 'TrainingAssignment', subjectId: assignment.id }) });
        assignments.push(assignment);
      }
      return assignments;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    sendData(response, { assignments: created }, 201);
  });

  router.get('/owner/organizations/:organizationId/assignments', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: organizationId } = routeIdSchema.parse({ id: request.params.organizationId });
    await requireOwnerOrganization(prisma, organizationId, user.id);
    const assignments = await prisma.trainingAssignment.findMany({
      where: { organizationId },
      include: { worker: true, training: { select: { id: true, title: true } }, competencies: { include: { competency: true } } },
      orderBy: [{ dueAt: 'asc' }, { assignedAt: 'desc' }],
    });
    const now = new Date();
    sendData(response, { assignments: assignments.map((assignment) => ({ ...assignment, effectiveStatus: assignment.dueAt && assignment.dueAt < now && ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'NEEDS_IMPROVEMENT'].includes(assignment.status) ? 'OVERDUE' : assignment.status })) });
  });

  router.post('/owner/organizations/:organizationId/competencies/:competencyId/approve', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: organizationId } = routeIdSchema.parse({ id: request.params.organizationId });
    const { id: competencyId } = routeIdSchema.parse({ id: request.params.competencyId });
    await requireOwnerOrganization(prisma, organizationId, user.id);
    const input = approveCompetencySchema.parse({ ...request.body, organizationId });
    const competency = assertFound(await prisma.competency.findFirst({
      where: { id: competencyId, organizationId },
      include: { requirements: { orderBy: { position: 'asc' } } },
    }), 'Competency was not found.');
    const worker = assertFound(await prisma.workerProfile.findFirst({ where: { id: input.workerProfileId, organizationId, status: 'ACTIVE' } }), 'Worker was not found.');
    const assignment = assertFound(await prisma.trainingAssignment.findFirst({ where: { organizationId, workerProfileId: worker.id, trainingId: competency.trainingId, competencies: { some: { competencyId } } } }), 'Required training assignment was not found.');
    const session = await prisma.trainingSession.findFirst({ where: { assignmentId: assignment.id, status: 'COMPLETED' }, orderBy: { completedAt: 'desc' } });
    if (!session) throw new HttpError(409, 'COMPETENCY_NOT_PASSED', 'The assigned training must be completed before competency approval.');
    const latest = await prisma.stepAttempt.findMany({
      where: { sessionId: session.id, stepId: { in: competency.requirements.filter((requirement) => requirement.required).map((requirement) => requirement.stepId) } },
      orderBy: { attemptNumber: 'desc' },
      distinct: ['stepId'],
      select: { stepId: true, verificationStatus: true },
    });
    const passed = new Set(latest.filter((attempt) => attempt.verificationStatus === 'PASSED').map((attempt) => attempt.stepId));
    const missing = competency.requirements.filter((requirement) => requirement.required && !passed.has(requirement.stepId));
    if (missing.length) throw new HttpError(409, 'COMPETENCY_NOT_PASSED', 'Required practical checkpoints have not all passed.');
    const verifiedAt = new Date();
    const reassessAt = competency.reassessmentDays ? new Date(verifiedAt.getTime() + competency.reassessmentDays * 86400000) : null;
    const record = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.workerCompetency.upsert({
        where: { workerProfileId_competencyId: { workerProfileId: worker.id, competencyId } },
        create: { workerProfileId: worker.id, competencyId, status: 'VERIFIED', approvedByUserId: user.id, verifiedAt, reassessAt, feedback: input.feedback },
        update: { status: 'VERIFIED', approvedByUserId: user.id, verifiedAt, reassessAt, feedback: input.feedback },
      });
      await transaction.trainingAssignment.update({ where: { id: assignment.id }, data: { status: 'APPROVED', approvedAt: verifiedAt } });
      await transaction.auditEvent.create({ data: auditData({ organizationId, actorUserId: user.id, action: 'COMPETENCY_APPROVED', subjectType: 'WorkerCompetency', subjectId: updated.id }) });
      return updated;
    });
    sendData(response, { competency: record });
  });

  router.get('/owner/organizations/:organizationId/activity', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: organizationId } = routeIdSchema.parse({ id: request.params.organizationId });
    await requireOwnerOrganization(prisma, organizationId, user.id);
    const events = await prisma.auditEvent.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 50, include: { actor: { select: { id: true, name: true } } } });
    sendData(response, { events });
  });

  router.get('/owner/organizations/:organizationId/reports', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const query = ownerReportQuerySchema.parse({ ...request.query, organizationId: request.params.organizationId });
    await requireOwnerOrganization(prisma, query.organizationId, user.id);
    const assignmentWhere: Prisma.TrainingAssignmentWhereInput = {
      organizationId: query.organizationId,
      ...(query.department ? { worker: { department: query.department } } : {}),
      ...(query.from || query.to ? { assignedAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}),
    };
    const [assignments, verifiedCompetencies, pendingAssessments] = await Promise.all([
      prisma.trainingAssignment.findMany({ where: assignmentWhere, include: { worker: true, training: { select: { id: true, title: true } } }, orderBy: { assignedAt: 'desc' } }),
      prisma.workerCompetency.count({ where: { worker: { organizationId: query.organizationId }, status: 'VERIFIED', ...(query.department ? { worker: { organizationId: query.organizationId, department: query.department } } : {}) } }),
      prisma.stepAttempt.count({ where: { verificationStatus: 'NEEDS_REVIEW', session: { project: { organizationId: query.organizationId }, ...(query.department ? { learner: { workerProfiles: { some: { organizationId: query.organizationId, department: query.department } } } } : {}) } } }),
    ]);
    const now = new Date();
    const completed = assignments.filter((assignment) => ['PASSED', 'APPROVED'].includes(assignment.status)).length;
    const overdue = assignments.filter((assignment) => assignment.dueAt && assignment.dueAt < now && ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'NEEDS_IMPROVEMENT'].includes(assignment.status)).length;
    const byTraining = new Map<string, { title: string; assigned: number; completed: number; overdue: number }>();
    for (const assignment of assignments) {
      const row = byTraining.get(assignment.trainingId) ?? { title: assignment.training.title, assigned: 0, completed: 0, overdue: 0 };
      row.assigned += 1;
      if (['PASSED', 'APPROVED'].includes(assignment.status)) row.completed += 1;
      if (assignment.dueAt && assignment.dueAt < now && ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'NEEDS_IMPROVEMENT'].includes(assignment.status)) row.overdue += 1;
      byTraining.set(assignment.trainingId, row);
    }
    sendData(response, {
      summary: { assigned: assignments.length, completed, completionPercentage: assignments.length ? Math.round(completed / assignments.length * 100) : 0, overdue, verifiedCompetencies, pendingAssessments },
      assignments,
      byTraining: Array.from(byTraining.values()),
      denominator: assignments.length,
    });
  });

  router.get('/owner/organizations/:organizationId/reports/export.csv', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: organizationId } = routeIdSchema.parse({ id: request.params.organizationId });
    await requireOwnerOrganization(prisma, organizationId, user.id);
    const assignments = await prisma.trainingAssignment.findMany({ where: { organizationId }, include: { worker: true, training: { select: { title: true } } }, orderBy: { assignedAt: 'desc' } });
    const safe = (value: string) => `"${(value.startsWith('=') || value.startsWith('+') || value.startsWith('-') || value.startsWith('@') ? `'${value}` : value).replaceAll('"', '""')}"`;
    const rows = [['Worker', 'Employee ID', 'Department', 'Training', 'Status', 'Assigned At', 'Due At'], ...assignments.map((assignment) => [assignment.worker.fullName, assignment.worker.employeeId, assignment.worker.department, assignment.training.title, assignment.status, assignment.assignedAt.toISOString(), assignment.dueAt?.toISOString() ?? ''])];
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="skillmirror-report.csv"');
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(rows.map((row) => row.map(safe).join(',')).join('\r\n'));
    await prisma.auditEvent.create({ data: auditData({ organizationId, actorUserId: user.id, action: 'REPORT_EXPORTED', subjectType: 'Organization', subjectId: organizationId }) });
  });

  router.get('/worker/assignments', async (_request, response) => {
    const user = response.locals.user as AuthUser;
    const profiles = await prisma.workerProfile.findMany({ where: { userId: user.id, status: 'ACTIVE' }, select: { id: true, organizationId: true } });
    const assignments = await prisma.trainingAssignment.findMany({
      where: { workerProfileId: { in: profiles.map((profile) => profile.id) } },
      include: { organization: { select: { id: true, name: true } }, training: { include: trainingInclude }, competencies: { include: { competency: true } }, sessions: { orderBy: { updatedAt: 'desc' }, take: 1 } },
      orderBy: [{ dueAt: 'asc' }, { assignedAt: 'desc' }],
    });
    const now = new Date();
    sendData(response, { assignments: assignments.map((assignment) => ({ ...assignment, effectiveStatus: assignment.dueAt && assignment.dueAt < now && ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'NEEDS_IMPROVEMENT'].includes(assignment.status) ? 'OVERDUE' : assignment.status })) });
  });

  router.get('/worker/assignments/:assignmentId', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: assignmentId } = routeIdSchema.parse({ id: request.params.assignmentId });
    const profiles = await prisma.workerProfile.findMany({ where: { userId: user.id, status: 'ACTIVE' }, select: { id: true } });
    const assignment = assertFound(await prisma.trainingAssignment.findFirst({
      where: { id: assignmentId, workerProfileId: { in: profiles.map((profile) => profile.id) } },
      include: {
        organization: true,
        training: { include: trainingInclude },
        competencies: { include: { competency: { include: { requirements: { include: { step: true }, orderBy: { position: 'asc' } } } } } },
        sessions: { orderBy: { updatedAt: 'desc' }, take: 1 },
      },
    }), 'Assignment was not found.');
    sendData(response, { assignment });
  });

  router.post('/worker/invitations/accept', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const input = acceptWorkerInvitationSchema.parse(request.body);
    const invitation = assertFound(await prisma.workerInvitation.findUnique({ where: { tokenHash: tokenHash(input.token) }, include: { workerProfile: true } }), 'Invitation is invalid or expired.');
    if (invitation.acceptedAt || invitation.expiresAt <= new Date() || invitation.workerProfile.email !== user.email.toLowerCase()) {
      throw new HttpError(400, 'INVALID_INVITATION', 'Invitation is invalid or expired.');
    }
    const accepted = await prisma.$transaction(async (transaction) => {
      const worker = await transaction.workerProfile.update({ where: { id: invitation.workerProfileId }, data: { userId: user.id } });
      await transaction.organizationMembership.create({ data: { organizationId: worker.organizationId, userId: user.id, role: 'WORKER' } });
      await transaction.workerInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
      await transaction.auditEvent.create({ data: auditData({ organizationId: worker.organizationId, actorUserId: user.id, action: 'INVITATION_ACCEPTED', subjectType: 'WorkerProfile', subjectId: worker.id }) });
      return worker;
    });
    sendData(response, { worker: accepted, organizationMembership: 'WORKER' });
  });

  router.get('/worker/progress', async (_request, response) => {
    const user = response.locals.user as AuthUser;
    const profiles = await prisma.workerProfile.findMany({ where: { userId: user.id, status: 'ACTIVE' }, select: { id: true } });
    const [assignments, competencies] = await Promise.all([
      prisma.trainingAssignment.findMany({ where: { workerProfileId: { in: profiles.map((profile) => profile.id) } }, include: { training: { select: { title: true } } }, orderBy: { assignedAt: 'desc' } }),
      prisma.workerCompetency.findMany({ where: { workerProfileId: { in: profiles.map((profile) => profile.id) } }, include: { competency: { select: { name: true, description: true } }, approvedBy: { select: { name: true } } }, orderBy: { updatedAt: 'desc' } }),
    ]);
    sendData(response, { assignments, competencies });
  });

  return router;
}