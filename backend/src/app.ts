import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { PrismaClient } from '../generated/client/client.js';
import { loadConfig, type AppConfig } from './config/env.js';
import { createPrismaClient } from './db.js';
import { errorHandler, HttpError } from './errors.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createLearningRouter } from './routes/learning.routes.js';
import { createMediaRouter } from './routes/media.routes.js';
import { createTrainingRouter } from './routes/training.routes.js';
import { createFactoryRouter } from './routes/factory.routes.js';
import { LocalMediaStorage } from './storage/localMediaStorage.js';
import { sendData } from './utils/response.js';

// Keep this in sync with backend/prisma/migrations. Readiness must fail closed
// when a release is running against a database that has not reached its schema.
const REQUIRED_MIGRATIONS = [
  '20261024140000_initial',
  '20261024160000_factory_workforce',
] as const;

export type AppDependencies = {
  prisma?: PrismaClient;
  config?: AppConfig;
  storage?: LocalMediaStorage;
};

export function createApp(dependencies: AppDependencies = {}) {
  const config = dependencies.config ?? loadConfig();
  const database = dependencies.prisma ?? createPrismaClient(config.databaseUrl);
  const storage = dependencies.storage ?? new LocalMediaStorage(config.mediaStorageDir);
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.nodeEnv === 'production' ? 1 : false);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({
    origin: config.frontendOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  }));
  app.use((request, _response, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      next();
      return;
    }
    if (request.get('origin') !== config.frontendOrigin) {
      next(new HttpError(403, 'INVALID_ORIGIN', 'The request origin is not allowed.'));
      return;
    }
    next();
  });
  app.use(express.json({ limit: '1mb', type: 'application/json' }));
  app.use((request: Request, response: Response, next: NextFunction) => {
    const startedAt = Date.now();
    response.on('finish', () => {
      console.info(JSON.stringify({ level: 'info', event: 'http_request', method: request.method, status: response.statusCode, durationMs: Date.now() - startedAt }));
    });
    next();
  });

  const api = express.Router();
  api.get('/health', (_request, response) => sendData(response, { status: 'ok' }));
  api.get('/ready', async (_request, response) => {
    await database.$queryRaw`SELECT 1`;

    const [migrationTable] = await database.$queryRaw<Array<{ present: boolean }>>`
      SELECT to_regclass('"public"."_prisma_migrations"') IS NOT NULL AS present
    `;
    if (!migrationTable?.present) {
      throw new HttpError(503, 'DATABASE_SCHEMA_NOT_READY', 'Database migrations have not been applied.');
    }

    const appliedRows = await database.$queryRaw<Array<{ migration_name: string }>>`
      SELECT "migration_name"
      FROM "public"."_prisma_migrations"
      WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL
    `;
    const appliedMigrations = new Set(appliedRows.map(({ migration_name }) => migration_name));
    const missingMigrations = REQUIRED_MIGRATIONS.filter((name) => !appliedMigrations.has(name));
    if (missingMigrations.length > 0) {
      throw new HttpError(503, 'DATABASE_SCHEMA_NOT_READY', 'Database migrations have not been applied.', { missingMigrations });
    }

    sendData(response, { status: 'ready' });
  });
  api.use('/auth', createAuthRouter(database, config));
  api.use(createFactoryRouter(database));
  api.use('/trainings', createTrainingRouter(database, storage));
  api.use(createLearningRouter(database));
  api.use(createMediaRouter(database, storage));

  app.use('/api/v1', api);
  app.use((_request, _response, next) => next(new HttpError(404, 'NOT_FOUND', 'The requested endpoint was not found.')));
  app.use(errorHandler);
  return app;
}
