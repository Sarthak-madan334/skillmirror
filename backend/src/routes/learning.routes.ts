import { Prisma, PrismaClient } from '../../generated/client/client.js';
import { Router } from 'express';
import { requireAuth, type AuthUser } from '../auth.js';
import { assertFound, HttpError } from '../errors.js';
import { reviewAttemptSchema, routeIdSchema, sessionProgressSchema, sessionRouteSchema, submitAttemptSchema } from '../schemas.js';
import { findReadableTraining, findSessionAccess, findOwnedTraining, findWorkerProfile, requireOwnerOrganization } from '../services/access.js';
import { sendData } from '../utils/response.js';

type StepForReport = { id: string; title: string; position: number; attempts: Array<{ id: string; attemptNumber: number; verificationStatus: string; feedback: string; submittedAt: Date; simulated: boolean }> };

export function summarizeAttempts(steps: StepForReport[]) {
  const results = steps.map((step) => ({
    stepId: step.id,
    title: step.title,
    latestAttempt: [...step.attempts].sort((left, right) => right.attemptNumber - left.attemptNumber)[0] ?? null,
  }));
  const attemptedSteps = results.filter((result) => result.latestAttempt).length;
  const passedSteps = results.filter((result) => result.latestAttempt?.verificationStatus === 'PASSED').length;
  const stepsNeedingImprovement = results.filter((result) => result.latestAttempt?.verificationStatus === 'NEEDS_IMPROVEMENT').length;
  const pendingSteps = results.filter((result) => result.latestAttempt?.verificationStatus === 'NEEDS_REVIEW').length;
  const totalSteps = steps.length;
  const recommendations = results.flatMap((result) => {
    if (!result.latestAttempt) return [`Start with “${result.title}”.`];
    if (result.latestAttempt.verificationStatus === 'NEEDS_REVIEW') return [`“${result.title}” is waiting for instructor review.`];
    if (result.latestAttempt.verificationStatus === 'NEEDS_IMPROVEMENT') return [`Review the feedback for “${result.title}” and try it again.`];
    if (result.latestAttempt.verificationStatus === 'UNABLE_TO_VERIFY') return [`Ask an instructor how to provide evidence for “${result.title}”.`];
    return [];
  });
  return {
    results,
    totalSteps,
    attemptedSteps,
    passedSteps,
    stepsNeedingImprovement,
    pendingSteps,
    completionPercentage: totalSteps ? Math.round((passedSteps / totalSteps) * 100) : 0,
    recommendations,
  };
}

async function persistReport(prisma: PrismaClient, sessionId: string) {
  const session = assertFound(await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: { project: { include: { steps: { orderBy: { position: 'asc' }, include: { attempts: { where: { sessionId }, orderBy: { attemptNumber: 'desc' } } } } } } },
  }), 'Training session was not found.');
  const summary = summarizeAttempts(session.project.steps);
  const report = await prisma.assessmentReport.upsert({
    where: { sessionId },
    create: {
      sessionId,
      totalSteps: summary.totalSteps,
      attemptedSteps: summary.attemptedSteps,
      passedSteps: summary.passedSteps,
      stepsNeedingImprovement: summary.stepsNeedingImprovement,
      completionPercentage: summary.completionPercentage,
      recommendations: summary.recommendations,
      assessmentMethod: 'HUMAN_REVIEWED_ATTEMPTS',
      simulated: false,
    },
    update: {
      totalSteps: summary.totalSteps,
      attemptedSteps: summary.attemptedSteps,
      passedSteps: summary.passedSteps,
      stepsNeedingImprovement: summary.stepsNeedingImprovement,
      completionPercentage: summary.completionPercentage,
      recommendations: summary.recommendations,
      assessmentMethod: 'HUMAN_REVIEWED_ATTEMPTS',
      simulated: false,
    },
  });
  return { ...report, results: summary.results, pendingSteps: summary.pendingSteps };
}

export function createLearningRouter(prisma: PrismaClient): Router {
  const router = Router();
  router.use(requireAuth(prisma));

  router.post('/worker/assignments/:assignmentId/sessions', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: assignmentId } = routeIdSchema.parse({ id: request.params.assignmentId });
    const assignment = assertFound(await prisma.trainingAssignment.findFirst({
      where: { id: assignmentId, worker: { userId: user.id, status: 'ACTIVE' } },
      include: { training: { select: { id: true, status: true } }, worker: { select: { id: true, organizationId: true } } },
    }), 'Training assignment was not found.');
    await findWorkerProfile(prisma, assignment.worker.organizationId, user.id);
    if (assignment.training.status !== 'PUBLISHED') throw new HttpError(409, 'TRAINING_NOT_PUBLISHED', 'This assigned training is not currently available.');
    const existing = await prisma.trainingSession.findFirst({ where: { assignmentId, status: { in: ['IN_PROGRESS', 'PAUSED'] } }, orderBy: { updatedAt: 'desc' } });
    if (existing) {
      const session = existing.status === 'PAUSED'
        ? await prisma.trainingSession.update({ where: { id: existing.id }, data: { status: 'IN_PROGRESS' } })
        : existing;
      await prisma.trainingAssignment.updateMany({ where: { id: assignmentId, status: 'ASSIGNED' }, data: { status: 'IN_PROGRESS' } });
      sendData(response, session);
      return;
    }
    const session = await prisma.$transaction(async (transaction) => {
      const created = await transaction.trainingSession.create({ data: { learnerId: user.id, projectId: assignment.trainingId, assignmentId } });
      await transaction.trainingAssignment.update({ where: { id: assignmentId }, data: { status: 'IN_PROGRESS' } });
      return created;
    });
    sendData(response, session, 201);
  });

  router.post('/trainings/:trainingId/sessions', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: projectId } = routeIdSchema.parse({ id: request.params.trainingId });
    const project = await findReadableTraining(prisma, projectId, user.id);
    if (project.status !== 'PUBLISHED') throw new HttpError(422, 'TRAINING_NOT_PUBLISHED', 'Publish this guide before starting a learner session.');
    const steps = await prisma.trainingStep.count({ where: { projectId } });
    if (!steps) throw new HttpError(422, 'TRAINING_NOT_READY', 'This training has no steps to practise.');
    const existing = await prisma.trainingSession.findFirst({ where: { projectId, learnerId: user.id, status: { in: ['IN_PROGRESS', 'PAUSED'] } }, orderBy: { updatedAt: 'desc' } });
    if (existing) {
      const resumed = existing.status === 'PAUSED'
        ? await prisma.trainingSession.update({ where: { id: existing.id }, data: { status: 'IN_PROGRESS' } })
        : existing;
      sendData(response, resumed);
      return;
    }
    const session = await prisma.trainingSession.create({ data: { projectId: project.id, learnerId: user.id } });
    sendData(response, session, 201);
  });

  router.get('/sessions/:sessionId', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { sessionId } = sessionRouteSchema.parse({ sessionId: request.params.sessionId });
    await findSessionAccess(prisma, sessionId, user.id);
    const session = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      include: {
        project: { include: { steps: { orderBy: { position: 'asc' } } } },
        attempts: { include: { evidence: { select: { id: true, mimeType: true, sizeBytes: true } } }, orderBy: { submittedAt: 'asc' } },
      },
    });
    sendData(response, assertFound(session));
  });

  router.patch('/sessions/:sessionId/progress', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { sessionId } = sessionRouteSchema.parse({ sessionId: request.params.sessionId });
    const session = await findSessionAccess(prisma, sessionId, user.id);
    if (session.learnerId !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Only the learner can update session progress.');
    if (session.status === 'COMPLETED') throw new HttpError(409, 'SESSION_COMPLETED', 'A completed session cannot be changed.');
    const input = sessionProgressSchema.parse(request.body);
    const totalSteps = await prisma.trainingStep.count({ where: { projectId: session.projectId } });
    if (input.currentPosition >= totalSteps) throw new HttpError(400, 'INVALID_STEP_POSITION', 'The current step position is outside this training.');
    sendData(response, await prisma.trainingSession.update({
      where: { id: sessionId },
      data: { currentPosition: input.currentPosition, ...(input.status ? { status: input.status } : {}) },
    }));
  });

  router.post('/sessions/:sessionId/steps/:stepId/attempts', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { sessionId } = sessionRouteSchema.parse({ sessionId: request.params.sessionId });
    const { id: stepId } = routeIdSchema.parse({ id: request.params.stepId });
    const session = await findSessionAccess(prisma, sessionId, user.id);
    if (session.learnerId !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Only the learner can submit an attempt.');
    if (session.status !== 'IN_PROGRESS') throw new HttpError(409, 'SESSION_NOT_ACTIVE', 'This session is not accepting attempts.');
    const step = await prisma.trainingStep.findFirst({ where: { id: stepId, projectId: session.projectId } });
    assertFound(step, 'Training step was not found.');
    const { evidenceIds } = submitAttemptSchema.parse(request.body);
    if (evidenceIds.length) {
      const evidence = await prisma.mediaAsset.findMany({ where: { id: { in: evidenceIds }, ownerId: user.id, sessionId, stepId, attemptId: null }, select: { id: true } });
      if (evidence.length !== evidenceIds.length) throw new HttpError(400, 'INVALID_EVIDENCE', 'Evidence must belong to this learner and session.');
    }

    const status = evidenceIds.length ? 'NEEDS_REVIEW' : 'UNABLE_TO_VERIFY';
    const feedback = evidenceIds.length
      ? 'Evidence was submitted for instructor review. No automated verification was performed.'
      : 'No evidence was attached, so this step could not be verified. Ask an instructor for help.';
    const attempt = await prisma.$transaction(async (transaction) => {
      const previousAttempts = await transaction.stepAttempt.count({ where: { sessionId, stepId } });
      const created = await transaction.stepAttempt.create({
        data: {
          sessionId,
          stepId,
          attemptNumber: previousAttempts + 1,
          verificationStatus: status,
          feedback,
          verificationMethod: evidenceIds.length ? 'HUMAN_REVIEW' : 'NO_EVIDENCE',
          simulated: false,
        },
      });
      if (evidenceIds.length) {
        const attached = await transaction.mediaAsset.updateMany({ where: { id: { in: evidenceIds }, ownerId: user.id, sessionId, stepId, attemptId: null }, data: { attemptId: created.id } });
        if (attached.count !== evidenceIds.length) throw new HttpError(409, 'EVIDENCE_ALREADY_USED', 'One or more evidence files are already attached to another attempt.');
      }
      return transaction.stepAttempt.findUnique({ where: { id: created.id }, include: { evidence: { select: { id: true, mimeType: true, sizeBytes: true } } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    sendData(response, assertFound(attempt), 201);
  });

  router.get('/sessions/:sessionId/attempts', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { sessionId } = sessionRouteSchema.parse({ sessionId: request.params.sessionId });
    await findSessionAccess(prisma, sessionId, user.id);
    const attempts = await prisma.stepAttempt.findMany({
      where: { sessionId },
      orderBy: [{ submittedAt: 'asc' }, { attemptNumber: 'asc' }],
      include: { evidence: { select: { id: true, mimeType: true, sizeBytes: true } }, step: { select: { id: true, title: true, position: true } } },
    });
    sendData(response, { attempts });
  });

  router.patch('/sessions/:sessionId/attempts/:attemptId/review', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { sessionId, attemptId } = sessionRouteSchema.parse({ sessionId: request.params.sessionId, attemptId: request.params.attemptId });
    const session = await findSessionAccess(prisma, sessionId, user.id);
    if (session.project.organizationId) await requireOwnerOrganization(prisma, session.project.organizationId, user.id);
    else if (session.project.ownerId !== user.id) throw new HttpError(404, 'NOT_FOUND', 'Training session was not found.');
    const input = reviewAttemptSchema.parse(request.body);
    const attempt = assertFound(await prisma.stepAttempt.findFirst({ where: { id: attemptId, sessionId } }), 'Attempt was not found.');
    if (attempt.verificationStatus !== 'NEEDS_REVIEW') throw new HttpError(409, 'ATTEMPT_NOT_REVIEWABLE', 'Only attempts awaiting human review can be reviewed.');
    const reviewed = await prisma.stepAttempt.update({
      where: { id: attemptId },
      data: { verificationStatus: input.status, feedback: input.feedback, verificationMethod: 'HUMAN_REVIEW', reviewedAt: new Date(), simulated: false },
    });
    if (session.assignmentId) {
      const [steps, latestAttempts] = await Promise.all([
        prisma.trainingStep.findMany({ where: { projectId: session.projectId }, select: { id: true } }),
        prisma.stepAttempt.findMany({ where: { sessionId }, orderBy: { attemptNumber: 'desc' }, distinct: ['stepId'], select: { stepId: true, verificationStatus: true } }),
      ]);
      const latestByStep = new Map(latestAttempts.map((item) => [item.stepId, item.verificationStatus]));
      const allPassed = steps.length > 0 && steps.every((item) => latestByStep.get(item.id) === 'PASSED');
      const anyNeedsWork = latestAttempts.some((item) => item.verificationStatus === 'NEEDS_IMPROVEMENT');
      await prisma.trainingAssignment.update({
        where: { id: session.assignmentId },
        data: { status: allPassed ? 'PASSED' : anyNeedsWork ? 'NEEDS_IMPROVEMENT' : 'SUBMITTED' },
      });
    }
    sendData(response, reviewed);
  });

  router.get('/sessions/:sessionId/report', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { sessionId } = sessionRouteSchema.parse({ sessionId: request.params.sessionId });
    await findSessionAccess(prisma, sessionId, user.id);
    sendData(response, await persistReport(prisma, sessionId));
  });

  router.post('/sessions/:sessionId/complete', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { sessionId } = sessionRouteSchema.parse({ sessionId: request.params.sessionId });
    const session = await findSessionAccess(prisma, sessionId, user.id);
    if (session.learnerId !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Only the learner can complete this session.');
    if (session.status === 'COMPLETED') {
      sendData(response, await persistReport(prisma, sessionId));
      return;
    }

    const [steps, attempts] = await Promise.all([
      prisma.trainingStep.findMany({ where: { projectId: session.projectId }, select: { id: true } }),
      prisma.stepAttempt.findMany({ where: { sessionId }, orderBy: { attemptNumber: 'desc' }, distinct: ['stepId'], select: { stepId: true, verificationStatus: true } }),
    ]);
    const latestByStep = new Map(attempts.map((attempt) => [attempt.stepId, attempt.verificationStatus]));
    if (!steps.length || steps.some((step) => latestByStep.get(step.id) !== 'PASSED')) {
      throw new HttpError(409, 'STEPS_REMAIN', 'Every step needs a human-reviewed pass before the session can be completed.');
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.trainingSession.update({ where: { id: sessionId }, data: { status: 'COMPLETED', completedAt: new Date() } });
      if (session.assignmentId) {
        await transaction.trainingAssignment.update({
          where: { id: session.assignmentId },
          data: session.assignmentId ? { status: 'PASSED', completedAt: new Date() } : {},
        });
      }
    });
    sendData(response, await persistReport(prisma, sessionId));
  });

  return router;
}