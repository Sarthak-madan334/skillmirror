import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { PrismaClient } from '../generated/client/client.js';
import type { AppConfig } from '../src/config/env.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/auth.js';

const config: AppConfig = {
  nodeEnv: 'test',
  port: 8000,
  databaseUrl: 'postgresql://test:test@localhost:5432/test',
  frontendOrigin: 'http://localhost:5173',
  mediaStorageDir: './backend/storage-test',
};

const user = { id: 'user-1', name: 'Taylor Learner', email: 'taylor@example.test', role: 'USER' };
const testPassword = 'correct horse battery staple';
const storedUser = { ...user, passwordHash: '' };

beforeAll(async () => { storedUser.passwordHash = await hashPassword(testPassword); });
afterAll(() => vi.restoreAllMocks());

function makeDatabase(overrides: Record<string, unknown> = {}) {
  const attempts: Array<Record<string, any>> = [];
  const base = {
    user: {
      create: vi.fn(async ({ data }: { data: { name: string; email: string } }) => ({ id: user.id, name: data.name, email: data.email, role: 'USER' })),
      findUnique: vi.fn(async () => storedUser),
    },
    authSession: {
      create: vi.fn(async ({ data }: { data: { tokenHash: string } }) => ({ id: 'session-1', ...data })),
      findUnique: vi.fn(async () => ({ id: 'session-1', expiresAt: new Date(Date.now() + 60000), user })),
      delete: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    trainingProject: {
      create: vi.fn(async ({ data }: { data: Record<string, any> }) => ({ id: 'training-1', ...data, ownerId: user.id, steps: [] })),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
      findUnique: vi.fn(async () => ({ id: 'training-1', ownerId: user.id, status: 'PUBLISHED', steps: [] })),
    },
    trainingStep: {
      count: vi.fn(async () => 1),
      findFirst: vi.fn(async () => ({ id: 'step-1', projectId: 'training-1', position: 0 })),
      findMany: vi.fn(async () => [{ id: 'step-1' }]),
    },
    trainingSession: {
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => ({
        id: 'learning-1', learnerId: user.id, projectId: 'training-1', currentPosition: 0, status: 'IN_PROGRESS',
        project: { id: 'training-1', ownerId: user.id, title: 'Test training', status: 'PUBLISHED' },
      })),
      create: vi.fn(async () => ({ id: 'learning-1', learnerId: user.id, projectId: 'training-1', currentPosition: 0, status: 'IN_PROGRESS' })),
    },
    stepAttempt: {
      count: vi.fn(async ({ where }: { where: { sessionId?: string } }) => attempts.filter((attempt) => !where.sessionId || attempt.sessionId === where.sessionId).length),
      create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
        const attempt = { id: `attempt-${attempts.length + 1}`, ...data };
        attempts.push(attempt);
        return attempt;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => attempts.find((attempt) => attempt.id === where.id) ?? null),
      findMany: vi.fn(async () => attempts),
    },
    $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
    $transaction: vi.fn(async (operations: unknown[] | ((transaction: unknown) => unknown)) => {
      if (Array.isArray(operations)) return Promise.all(operations);
      return operations(base);
    }),
  };
  return Object.assign(base, overrides) as unknown as PrismaClient;
}

function makeApp(database = makeDatabase()) {
  return { app: createApp({ prisma: database, config }), database };
}

const origin = { Origin: config.frontendOrigin };

afterEach(() => vi.restoreAllMocks());

describe('API envelope and health', () => {
  it('serves liveness without querying the database', async () => {
    const { app, database } = makeApp();
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { status: 'ok' }, error: null });
    expect(database.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns a safe validation envelope for malformed project input', async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').set(origin).send({ email: user.email, password: testPassword });
    const response = await agent.post('/api/v1/trainings').set(origin).send({ title: '' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'title' })]));
    expect(JSON.stringify(response.body)).not.toContain('stack');
  });

  it('requires an authenticated session for private resources', async () => {
    const { app } = makeApp();
    const response = await request(app).get('/api/v1/trainings');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('authentication', () => {
  it('normalizes email and returns a generic registration response without signing in', async () => {
    const { app, database } = makeApp();
    const response = await request(app).post('/api/v1/auth/register').set(origin).send({
      name: 'Taylor Learner', email: 'Taylor@Example.test', password: 'StrongPassword123',
    });

    expect(response.status).toBe(202);
    expect(response.body.data).toEqual({ registrationAccepted: true });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(database.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ email: 'taylor@example.test' }),
    }));
    expect(database.authSession.create).not.toHaveBeenCalled();
  });

  it('uses a generic error for unknown users and rejects foreign origins', async () => {
    const database = makeDatabase({ user: { findUnique: vi.fn(async () => null) } });
    const { app } = makeApp(database);
    const badOrigin = await request(app).post('/api/v1/auth/login').set({ Origin: 'https://untrusted.example' }).send({ email: user.email, password: 'StrongPassword123' });
    expect(badOrigin.status).toBe(403);
    expect(badOrigin.body.error.code).toBe('INVALID_ORIGIN');
    const response = await request(app).post('/api/v1/auth/login').set(origin).send({ email: user.email, password: 'StrongPassword123' });
    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Email or password is incorrect.');
  });
});

describe('training ownership', () => {
  it('creates a draft under the authenticated owner and maps its status to frontend casing', async () => {
    const { app, database } = makeApp();
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').set(origin).send({ email: user.email, password: testPassword });
    const response = await agent.post('/api/v1/trainings').set(origin).send({
      title: 'Paper bridge', description: 'Build a paper span.', category: 'Maker skills',
      level: 'Beginner', duration: 12, objectives: '', materials: [], status: 'draft', steps: [],
    });
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ id: 'training-1', ownerId: user.id, status: 'draft' });
    expect(database.trainingProject.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ownerId: user.id, status: 'DRAFT' }),
    }));
  });

  it('does not reveal a draft owned by a different user', async () => {
    const database = makeDatabase({
      trainingProject: { findUnique: vi.fn(async () => ({ id: 'training-1', ownerId: 'other-user', status: 'DRAFT' })) },
    });
    const { app } = makeApp(database);
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').set(origin).send({ email: user.email, password: testPassword });
    const response = await agent.get('/api/v1/trainings/training-1');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('records missing evidence as unable to verify and refuses to complete the session', async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').set(origin).send({ email: user.email, password: testPassword });
    const opened = await agent.post('/api/v1/trainings/training-1/sessions').set(origin).send({});
    expect(opened.status).toBe(201);
    const attempt = await agent.post('/api/v1/sessions/learning-1/steps/step-1/attempts').set(origin).send({ evidenceIds: [] });
    expect(attempt.status).toBe(201);
    expect(attempt.body.data).toMatchObject({ verificationStatus: 'UNABLE_TO_VERIFY', verificationMethod: 'NO_EVIDENCE', simulated: false });
    const completion = await agent.post('/api/v1/sessions/learning-1/complete').set(origin).send({});
    expect(completion.status).toBe(409);
    expect(completion.body.error.code).toBe('STEPS_REMAIN');
  });
});