import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import type { PrismaClient, User } from '../generated/client/client.js';
import type { AppConfig } from './config/env.js';
import { HttpError } from './errors.js';

export const SESSION_COOKIE = 'skillmirror_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function tokenDigest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function readSessionToken(request: Request): string | undefined {
  const name = SESSION_COOKIE;
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;
  for (const cookie of cookieHeader.split(';')) {
    const separator = cookie.indexOf('=');
    if (separator < 0) continue;
    if (cookie.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(cookie.slice(separator + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function setSessionCookie(response: Response, token: string, config: AppConfig): void {
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/v1',
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(response: Response, config: AppConfig): void {
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/v1',
  });
}

export async function createAuthSession(prisma: PrismaClient, userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await prisma.authSession.create({
    data: { tokenHash: tokenDigest(token), userId, expiresAt: new Date(Date.now() + SESSION_MAX_AGE) },
  });
  return token;
}

export async function invalidateAuthSession(prisma: PrismaClient, token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.authSession.deleteMany({ where: { tokenHash: tokenDigest(token) } });
}

export type AuthUser = Pick<User, 'id' | 'name' | 'email' | 'role'>;

export function requireAuth(prisma: PrismaClient) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const token = readSessionToken(request);
      if (!token) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
      const session = await prisma.authSession.findUnique({
        where: { tokenHash: tokenDigest(token) },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      });
      if (!session || session.expiresAt <= new Date()) {
        if (session) await prisma.authSession.delete({ where: { id: session.id } });
        throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
      }
      response.locals.user = session.user satisfies AuthUser;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}