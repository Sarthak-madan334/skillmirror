import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import type { PrismaClient } from '../../generated/client/client.js';
import { fileTypeFromFile } from 'file-type';
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { requireAuth, type AuthUser } from '../auth.js';
import { HttpError, assertFound } from '../errors.js';
import { routeIdSchema } from '../schemas.js';
import { findOwnedTraining, findSessionAccess } from '../services/access.js';
import { ALLOWED_MEDIA_TYPES, MAX_MEDIA_SIZE_BYTES } from '../storage/localMediaStorage.js';
import { MediaStorage } from '../storage/mediaStorage.js';
import { sendData } from '../utils/response.js';

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (_request, response) => (response.locals.user as AuthUser).id,
  handler: (_request, response) => response.status(429).json({ success: false, data: null, error: { code: 'UPLOAD_RATE_LIMITED', message: 'Upload limit reached. Try again later.', details: null } }),
});
const MAX_USER_MEDIA_BYTES = 1024 * 1024 * 1024;
const MAX_USER_DAILY_UPLOAD_BYTES = 500 * 1024 * 1024;

function safeOriginalName(originalName: string): string {
  return (basename(originalName.replaceAll('\\', '/')).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255) || 'upload');
}

export function createMediaRouter(prisma: PrismaClient, storage: MediaStorage): Router {
  const router = Router();
  router.use(requireAuth(prisma));

  const fileUpload = (request: Request, response: Response, next: NextFunction) => {
    void storage.prepare().then(() => multer({
      dest: storage.temporaryDirectory,
      limits: { fileSize: MAX_MEDIA_SIZE_BYTES, files: 1, fields: 2 },
      fileFilter: (_incoming, file, callback) => {
        if (!ALLOWED_MEDIA_TYPES.has(file.mimetype)) {
          callback(new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Upload a JPEG, PNG, WebP, MP4, MOV, or WebM file.'));
          return;
        }
        callback(null, true);
      },
    }).single('file')(request, response, next)).catch(next);
  };

  const authorizeProjectUpload = (request: Request, response: Response, next: NextFunction) => {
    const user = response.locals.user as AuthUser;
    const { id: projectId } = routeIdSchema.parse({ id: request.params.trainingId });
    void findOwnedTraining(prisma, projectId, user.id).then(() => next()).catch(next);
  };

  const authorizeSessionUpload = (request: Request, response: Response, next: NextFunction) => {
    const user = response.locals.user as AuthUser;
    const { id: sessionId } = routeIdSchema.parse({ id: request.params.sessionId });
    void findSessionAccess(prisma, sessionId, user.id).then((session) => {
      if (session.learnerId !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Only the learner can upload session evidence.');
      if (session.status !== 'IN_PROGRESS') throw new HttpError(409, 'SESSION_NOT_ACTIVE', 'This session is not accepting evidence.');
      response.locals.authorizedSession = session;
      next();
    }).catch(next);
  };

  const persistUpload = async (file: Express.Multer.File | undefined, values: { ownerId: string; projectId: string; sessionId?: string; stepId?: string }) => {
    if (!file) throw new HttpError(400, 'FILE_REQUIRED', 'Attach a file using the `file` field.');
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [stored, recent] = await Promise.all([
        prisma.mediaAsset.aggregate({ where: { ownerId: values.ownerId }, _sum: { sizeBytes: true } }),
        prisma.mediaAsset.aggregate({ where: { ownerId: values.ownerId, createdAt: { gte: since } }, _sum: { sizeBytes: true } }),
      ]);
      if ((stored._sum.sizeBytes ?? 0) + file.size > MAX_USER_MEDIA_BYTES) throw new HttpError(413, 'USER_MEDIA_QUOTA', 'Your account has reached its 1 GiB media storage limit. Delete unused uploads before adding more.');
      if ((recent._sum.sizeBytes ?? 0) + file.size > MAX_USER_DAILY_UPLOAD_BYTES) throw new HttpError(429, 'DAILY_UPLOAD_QUOTA', 'Your account has reached its daily upload allowance. Try again later.');
      const detected = await fileTypeFromFile(file.path);
      if (!detected || !ALLOWED_MEDIA_TYPES.has(detected.mime) || detected.mime !== file.mimetype) {
        throw new HttpError(415, 'INVALID_FILE_CONTENT', 'The file content does not match a supported image or video type.');
      }
      const storageKey = storage.createKey(detected.mime);
      await storage.commit(file.path, storageKey);
      try {
        const asset = await prisma.mediaAsset.create({
          data: {
            ownerId: values.ownerId,
            projectId: values.projectId,
            ...(values.sessionId ? { sessionId: values.sessionId } : {}),
            ...(values.stepId ? { stepId: values.stepId } : {}),
            originalName: safeOriginalName(file.originalname),
            storageKey,
            mimeType: detected.mime,
            sizeBytes: file.size,
            provider: storage.provider,
          },
          select: { id: true, originalName: true, mimeType: true, sizeBytes: true, status: true, provider: true, createdAt: true },
        });
        return { ...asset, downloadUrl: `/api/v1/media/${asset.id}` };
      } catch (error) {
        await storage.remove(storageKey).catch(() => {
          console.error(JSON.stringify({ level: 'error', event: 'media_upload_cleanup_failed', provider: storage.provider }));
        });
        throw error;
      }
    } catch (error) {
      await storage.removeTemporary(file.path).catch(() => undefined);
      throw error;
    }
  };

  router.post('/trainings/:trainingId/media', uploadLimiter, authorizeProjectUpload, fileUpload, async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: projectId } = routeIdSchema.parse({ id: request.params.trainingId });
    await findOwnedTraining(prisma, projectId, user.id);
    const stepId = typeof request.body?.stepId === 'string' ? request.body.stepId : undefined;
    if (stepId) {
      const step = await prisma.trainingStep.findFirst({ where: { id: stepId, projectId }, select: { id: true } });
      if (!step) await storage.removeTemporary(request.file?.path || '');
      assertFound(step, 'Training step was not found.');
    }
    sendData(response, await persistUpload(request.file, { ownerId: user.id, projectId, stepId }), 201);
  });

  router.post('/sessions/:sessionId/media', uploadLimiter, authorizeSessionUpload, fileUpload, async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: sessionId } = routeIdSchema.parse({ id: request.params.sessionId });
    const session = response.locals.authorizedSession as Awaited<ReturnType<typeof findSessionAccess>>;
    let stepId: string;
    try {
      stepId = routeIdSchema.parse({ id: request.body?.stepId }).id;
    } catch (error) {
      await storage.removeTemporary(request.file?.path || '');
      throw error;
    }
    const step = await prisma.trainingStep.findFirst({ where: { id: stepId, projectId: session.projectId }, select: { id: true } });
    if (!step) await storage.removeTemporary(request.file?.path || '');
    assertFound(step, 'Training step was not found.');
    sendData(response, await persistUpload(request.file, { ownerId: user.id, projectId: session.projectId, sessionId, stepId }), 201);
  });

  router.get('/:assetId', async (request, response, next) => {
    try {
      const user = response.locals.user as AuthUser;
      const { id: assetId } = routeIdSchema.parse({ id: request.params.assetId });
      const asset = assertFound(await prisma.mediaAsset.findUnique({
        where: { id: assetId },
        include: {
          project: { select: { ownerId: true, status: true } },
          session: { select: { learnerId: true } },
        },
      }), 'Media was not found.');
      const canRead = asset.ownerId === user.id
        || asset.project?.ownerId === user.id
        || asset.session?.learnerId === user.id
        || (!asset.attemptId && asset.project?.status === 'PUBLISHED');
      if (!canRead) {
        throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Media was not found.');
      }
      const rangeHeader = request.get('range');
      let byteRange: { start: number; end: number } | undefined;
      if (rangeHeader) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
        if (!match || (!match[1] && !match[2]) || asset.sizeBytes <= 0) {
          response.setHeader('Content-Range', `bytes */${asset.sizeBytes}`);
          response.status(416).end();
          return;
        }
        if (!match[1]) {
          const suffix = Number(match[2]);
          if (!Number.isSafeInteger(suffix) || suffix <= 0) {
            response.setHeader('Content-Range', `bytes */${asset.sizeBytes}`);
            response.status(416).end();
            return;
          }
          byteRange = { start: Math.max(0, asset.sizeBytes - suffix), end: asset.sizeBytes - 1 };
        } else {
          const start = Number(match[1]);
          const requestedEnd = match[2] ? Number(match[2]) : asset.sizeBytes - 1;
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start >= asset.sizeBytes || requestedEnd < start) {
            response.setHeader('Content-Range', `bytes */${asset.sizeBytes}`);
            response.status(416).end();
            return;
          }
          byteRange = { start, end: Math.min(requestedEnd, asset.sizeBytes - 1) };
        }
      }
      const fileStream = await storage.openReadStream(asset.storageKey, asset.provider, byteRange);
      response.setHeader('Cache-Control', 'private, no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.type(asset.mimeType);
      response.setHeader('Content-Disposition', `inline; filename="${randomUUID()}"`);
      response.setHeader('Accept-Ranges', 'bytes');
      response.setHeader('Content-Length', String(byteRange ? byteRange.end - byteRange.start + 1 : asset.sizeBytes));
      if (byteRange) {
        response.status(206);
        response.setHeader('Content-Range', `bytes ${byteRange.start}-${byteRange.end}/${asset.sizeBytes}`);
      }
      fileStream.once('error', (error) => {
        console.error(JSON.stringify({ level: 'error', event: 'media_stream_failed', provider: asset.provider }));
        if (response.headersSent) response.destroy(error);
        else next(error);
      });
      fileStream.pipe(response);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:assetId', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: assetId } = routeIdSchema.parse({ id: request.params.assetId });
    const asset = assertFound(await prisma.mediaAsset.findFirst({ where: { id: assetId, ownerId: user.id } }), 'Media was not found.');
    if (asset.attemptId) throw new HttpError(409, 'MEDIA_IN_USE', 'Evidence attached to an attempt cannot be deleted.');
    await storage.remove(asset.storageKey, asset.provider);
    await prisma.mediaAsset.delete({ where: { id: assetId } });
    response.status(204).end();
  });

  return router;
}
