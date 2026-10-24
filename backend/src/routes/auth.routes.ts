import { Router } from 'express';
import { Prisma, type PrismaClient } from '../../generated/client/client.js';
import rateLimit from 'express-rate-limit';
import type { AppConfig } from '../config/env.js';
import {
  clearSessionCookie,
  createAuthSession,
  invalidateAuthSession,
  readSessionToken,
  requireAuth,
  setSessionCookie,
  verifyPassword,
  hashPassword,
} from '../auth.js';
import { HttpError } from '../errors.js';
import { loginSchema, registerSchema } from '../schemas.js';
import { sendData } from '../utils/response.js';

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false });

export function createAuthRouter(prisma: PrismaClient, config: AppConfig): Router {
  const router = Router();

  router.post('/register', registerLimiter, async (request, response) => {
    const input = registerSchema.parse(request.body);
    const email = input.email.toLowerCase();
    try {
      await prisma.user.create({
        data: { name: input.name, email, passwordHash: await hashPassword(input.password) },
        select: { id: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        sendData(response, { registrationAccepted: true }, 202);
        return;
      }
      throw error;
    }

    sendData(response, { registrationAccepted: true }, 202);
  });

  router.post('/login', loginLimiter, async (request, response) => {
    const input = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    const valid = user ? await verifyPassword(input.password, user.passwordHash) : await hashPassword(input.password).then(() => false);
    if (!user || !valid) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');

    const token = await createAuthSession(prisma, user.id);
    setSessionCookie(response, token, config);
    sendData(response, { user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });

  router.post('/logout', requireAuth(prisma), async (request, response) => {
    await invalidateAuthSession(prisma, readSessionToken(request));
    clearSessionCookie(response, config);
    sendData(response, { loggedOut: true });
  });

  router.get('/me', requireAuth(prisma), async (_request, response) => {
    const user = response.locals.user as { id: string };
    const [memberships, workerProfiles] = await Promise.all([
      prisma.organizationMembership.findMany({ where: { userId: user.id }, include: { organization: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } }),
      prisma.workerProfile.findMany({ where: { userId: user.id, status: 'ACTIVE' }, select: { id: true, organizationId: true, employeeId: true, department: true, organization: { select: { id: true, name: true } } } }),
    ]);
    sendData(response, { user: response.locals.user, memberships, workerProfiles });
  });

  return router;
}