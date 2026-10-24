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
import { ALLOWED_MEDIA_TYPES, LocalMediaStorage, MAX_MEDIA_SIZE_BYTES } from '../storage/localMediaStorage.js';
import { sendData } from '../utils/response.js';

const uploadLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });

function safeOriginalName(originalName: string): string {
  return (basename(originalName.replaceAll('\\', '/')).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255) || 'upload');
}

export function createMediaRouter(prisma: PrismaClient, storage: LocalMediaStorage): Router {
  const router = Router();
  router.use(requireAuth(prisma));

  const fileUpload = (request: Request, response: Response, next: NextFunction) => {
    void storage.prepare().then(() => multer({
      dest: storage.temporaryDirectory,
      limits: { fileSize: MAX_MEDIA_SIZE_BYTES, files: 1 },
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
      const detected = await fileTypeFromFile(file.path);
      if (!detected || !ALLOWED_MEDIA_TYPES.has(detected.mime) || detected.mime !== file.mimetype) {
        throw new HttpError(415, 'INVALID_FILE_CONTENT', 'The file content does not match a supported image or video type.');
      }
      const storageKey = storage.createKey(detected.mime);
      const finalPath = await storage.commit(file.path, storageKey);
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
          },
          select: { id: true, originalName: true, mimeType: true, sizeBytes: true, status: true, provider: true, createdAt: true },
        });
        return { ...asset, downloadUrl: `/api/v1/media/${asset.id}` };
      } catch (error) {
        await storage.remove(storageKey).catch(() => undefined);
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
      const filePath = storage.resolveKey(asset.storageKey);
      response.setHeader('Cache-Control', 'private, no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.type(asset.mimeType);
      response.setHeader('Content-Disposition', `inline; filename="${randomUUID()}"`);
      response.sendFile(filePath, (error) => { if (error) next(error); });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:assetId', async (request, response) => {
    const user = response.locals.user as AuthUser;
    const { id: assetId } = routeIdSchema.parse({ id: request.params.assetId });
    const asset = assertFound(await prisma.mediaAsset.findFirst({ where: { id: assetId, ownerId: user.id } }), 'Media was not found.');
    if (asset.attemptId) throw new HttpError(409, 'MEDIA_IN_USE', 'Evidence attached to an attempt cannot be deleted.');
    await prisma.mediaAsset.delete({ where: { id: assetId } });
    await storage.remove(asset.storageKey).catch(() => undefined);
    response.status(204).end();
  });

  return router;
}