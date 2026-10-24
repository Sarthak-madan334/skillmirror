import { Prisma, PrismaClient, TrainingStatus } from '../../generated/client/client.js';
import { Router } from 'express';
import { requireAuth, type AuthUser } from '../auth.js';
import { assertFound, HttpError } from '../errors.js';
import { createTrainingSchema, generationSchema, listTrainingsSchema, nestedRouteSchema, reorderStepsSchema, routeIdSchema, stepInputSchema, updateStepSchema, updateTrainingSchema } from '../schemas.js';
import { findOwnedTraining, findReadableTraining, assertStepIdSet } from '../services/access.js';
import { SampleStepGenerator } from '../services/demoGenerator.js';
import { LocalMediaStorage } from '../storage/localMediaStorage.js';
import { sendData } from '../utils/response.js';

const trainingInclude = { steps: { orderBy: { position: 'asc' as const } } };

function toClientTraining<T extends { status: TrainingStatus }>(training: T): Omit<T, 'status'> & { status: string } {
  return { ...training, status: training.status.toLowerCase() };
}

export function createTrainingRouter(prisma: PrismaClient, storage: LocalMediaStorage): Router {
  const router = Router();
  const stepGenerator = new SampleStepGenerator();
  router.use(requireAuth(prisma));

  router.get('/', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const query = listTrainingsSchema.parse(request.query);
    const where: Prisma.TrainingProjectWhereInput = {
      ownerId: user.id,
      ...(query.status ? { status: query.status.toUpperCase() as TrainingStatus } : {}),
      ...(query.search ? { OR: [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ] } : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.trainingProject.findMany({ where, include: trainingInclude, orderBy: { updatedAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      prisma.trainingProject.count({ where }),
    ]);
    sendData(response, { items: items.map(toClientTraining), page: query.page, pageSize: query.pageSize, total });
  });

  router.post('/', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const input = createTrainingSchema.parse(request.body);
    if (input.status === 'published' && input.steps.length === 0) {
      throw new HttpError(422, 'INCOMPLETE_TRAINING', 'Add at least one step before publishing.');
    }

    const created = await prisma.trainingProject.create({
      data: {
        ownerId: user.id,
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
    sendData(response, toClientTraining(created), 201);
  });

  router.post('/:trainingId/generate-steps', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: trainingId } = routeIdSchema.parse({ id: request.params.trainingId });
    const project = await findOwnedTraining(prisma, trainingId, user.id);
    const input = generationSchema.parse(request.body);
    const draft = await stepGenerator.generate({ title: project.title, description: project.description, mode: input.mode });
    sendData(response, { ...draft, approved: false });
  });

  router.put('/:trainingId/procedure', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: trainingId } = routeIdSchema.parse({ id: request.params.trainingId });
    await findOwnedTraining(prisma, trainingId, user.id);
    const input = createTrainingSchema.parse(request.body);
    if (input.status === 'published' && input.steps.length === 0) {
      throw new HttpError(422, 'INCOMPLETE_TRAINING', 'Add at least one step before publishing.');
    }
    const saved = await prisma.$transaction(async (transaction) => {
      const sessions = await transaction.trainingSession.count({ where: { projectId: trainingId } });
      if (sessions) throw new HttpError(409, 'TRAINING_HAS_HISTORY', 'This guide has learner sessions and its procedure cannot be replaced. Duplicate it to make changes.');
      await transaction.trainingStep.deleteMany({ where: { projectId: trainingId } });
      return transaction.trainingProject.update({
        where: { id: trainingId },
        data: {
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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    sendData(response, toClientTraining(saved));
  });

  router.get('/:trainingId/progress', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: trainingId } = routeIdSchema.parse({ id: request.params.trainingId });
    await findReadableTraining(prisma, trainingId, user.id);
    const sessions = await prisma.trainingSession.findMany({
      where: { projectId: trainingId, learnerId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: { attempts: { orderBy: [{ submittedAt: 'desc' }, { attemptNumber: 'desc' }] } },
    });
    sendData(response, { sessions });
  });

  router.get('/:trainingId', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: trainingId } = routeIdSchema.parse({ id: request.params.trainingId });
    await findReadableTraining(prisma, trainingId, user.id);
    const training = await prisma.trainingProject.findUnique({ where: { id: trainingId }, include: trainingInclude });
    sendData(response, toClientTraining(assertFound(training)));
  });

  router.patch('/:trainingId', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: trainingId } = routeIdSchema.parse({ id: request.params.trainingId });
    await findOwnedTraining(prisma, trainingId, user.id);
    const input = updateTrainingSchema.parse(request.body);
    const current = assertFound(await prisma.trainingProject.findUnique({ where: { id: trainingId }, include: { _count: { select: { steps: true } } } }));
    const sessions = await prisma.trainingSession.count({ where: { projectId: trainingId } });
    if (sessions && Object.keys(input).some((field) => field !== 'status')) {
      throw new HttpError(409, 'TRAINING_HAS_HISTORY', 'Training details cannot be edited after learner sessions have started. Duplicate the guide to make changes.');
    }
    if (input.status === 'published' && current._count.steps === 0) {
      throw new HttpError(422, 'INCOMPLETE_TRAINING', 'Add at least one step before publishing.');
    }

    const { status, demonstration, ...fields } = input;
    const updated = await prisma.trainingProject.update({
      where: { id: trainingId },
      data: {
        ...fields,
        ...(demonstration !== undefined ? { demonstration: demonstration ?? Prisma.JsonNull } : {}),
        ...(status ? { status: status.toUpperCase() as TrainingStatus } : {}),
      },
      include: trainingInclude,
    });
    sendData(response, toClientTraining(updated));
  });

  router.delete('/:trainingId', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: trainingId } = routeIdSchema.parse({ id: request.params.trainingId });
    await findOwnedTraining(prisma, trainingId, user.id);
    const sessions = await prisma.trainingSession.count({ where: { projectId: trainingId } });
    if (sessions > 0) throw new HttpError(409, 'TRAINING_HAS_HISTORY', 'This guide has learner history and cannot be deleted. Archive it instead.');

    const assets = await prisma.mediaAsset.findMany({ where: { projectId: trainingId }, select: { storageKey: true } });
    await prisma.trainingProject.delete({ where: { id: trainingId } });
    await Promise.all(assets.map(({ storageKey }) => storage.remove(storageKey).catch(() => undefined)));
    response.status(204).end();
  });

  router.post('/:trainingId/steps', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: trainingId } = routeIdSchema.parse({ id: request.params.trainingId });
    const project = await findOwnedTraining(prisma, trainingId, user.id);
    const input = stepInputSchema.parse(request.body);
    const sessionCount = await prisma.trainingSession.count({ where: { projectId: trainingId } });
    if (sessionCount) throw new HttpError(409, 'TRAINING_HAS_HISTORY', 'Steps cannot be changed after learner sessions have started. Duplicate this guide to make changes.');

    const position = await prisma.trainingStep.count({ where: { projectId: trainingId } });
    const step = await prisma.trainingStep.create({ data: { ...input, projectId: project.id, position } });
    sendData(response, step, 201);
  });

  router.put('/:trainingId/steps/reorder', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: trainingId } = routeIdSchema.parse({ id: request.params.trainingId });
    await findOwnedTraining(prisma, trainingId, user.id);
    const { stepIds } = reorderStepsSchema.parse(request.body);
    const sessionCount = await prisma.trainingSession.count({ where: { projectId: trainingId } });
    if (sessionCount) throw new HttpError(409, 'TRAINING_HAS_HISTORY', 'Step order cannot be changed after learner sessions have started. Duplicate this guide to make changes.');
    const existing = await prisma.trainingStep.findMany({ where: { projectId: trainingId }, select: { id: true } });
    assertStepIdSet(stepIds, existing.map((step) => step.id));
    await prisma.$transaction(async (transaction) => {
      const offset = existing.length + 1;
      await transaction.trainingStep.updateMany({ where: { projectId: trainingId }, data: { position: { increment: offset } } });
      for (const [position, id] of stepIds.entries()) {
        await transaction.trainingStep.update({ where: { id }, data: { position } });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const steps = await prisma.trainingStep.findMany({ where: { projectId: trainingId }, orderBy: { position: 'asc' } });
    sendData(response, { steps });
  });

  router.patch('/:trainingId/steps/:stepId', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { trainingId, stepId } = nestedRouteSchema.parse({ trainingId: request.params.trainingId, stepId: request.params.stepId });
    await findOwnedTraining(prisma, trainingId, user.id);
    const step = assertFound(await prisma.trainingStep.findFirst({ where: { id: stepId, projectId: trainingId } }), 'Training step was not found.');
    const sessions = await prisma.trainingSession.count({ where: { projectId: trainingId } });
    if (sessions) throw new HttpError(409, 'STEP_HAS_HISTORY', 'This guide has learner sessions and its steps cannot be edited. Duplicate the guide to change them.');
    const input = updateStepSchema.parse(request.body);
    sendData(response, await prisma.trainingStep.update({ where: { id: stepId }, data: input }));
  });

  router.delete('/:trainingId/steps/:stepId', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { trainingId, stepId } = nestedRouteSchema.parse({ trainingId: request.params.trainingId, stepId: request.params.stepId });
    await findOwnedTraining(prisma, trainingId, user.id);
    const step = assertFound(await prisma.trainingStep.findFirst({ where: { id: stepId, projectId: trainingId } }), 'Training step was not found.');
    const sessions = await prisma.trainingSession.count({ where: { projectId: trainingId } });
    if (sessions) throw new HttpError(409, 'STEP_HAS_HISTORY', 'This guide has learner sessions and its steps cannot be removed. Duplicate the guide to change them.');
    await prisma.$transaction(async (transaction) => {
      await transaction.trainingStep.delete({ where: { id: stepId } });
      const remaining = await transaction.trainingStep.findMany({ where: { projectId: trainingId }, orderBy: { position: 'asc' }, select: { id: true } });
      await transaction.trainingStep.updateMany({ where: { projectId: trainingId }, data: { position: { increment: remaining.length + 1 } } });
      for (const [position, step] of remaining.entries()) {
        await transaction.trainingStep.update({ where: { id: step.id }, data: { position } });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    response.status(204).end();
  });

  return router;
}