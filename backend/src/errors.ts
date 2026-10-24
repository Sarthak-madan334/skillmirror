import type { ErrorRequestHandler } from 'express';
import { Prisma } from '../generated/client/client.js';
import { MulterError } from 'multer';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.status).json({
      success: false,
      data: null,
      error: { code: error.code, message: error.message, details: error.details ?? null },
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      success: false,
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please check the submitted fields.',
        details: error.issues.map(({ path, message }) => ({ path: path.join('.'), message })),
      },
    });
    return;
  }

  if (error instanceof MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    response.status(tooLarge ? 413 : 400).json({
      success: false,
      data: null,
      error: {
        code: tooLarge ? 'PAYLOAD_TOO_LARGE' : 'UPLOAD_REJECTED',
        message: tooLarge ? 'The uploaded file exceeds the 250 MB limit.' : 'The upload could not be accepted.',
        details: null,
      },
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const known = error.code === 'P2002'
      ? { status: 409, code: 'CONFLICT', message: 'A record with these details already exists.' }
      : error.code === 'P2025'
        ? { status: 404, code: 'NOT_FOUND', message: 'The requested record was not found.' }
        : null;
    if (known) {
      response.status(known.status).json({ success: false, data: null, error: { code: known.code, message: known.message, details: null } });
      return;
    }
  }

  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ success: false, data: null, error: { code: 'INVALID_JSON', message: 'The request body must be valid JSON.', details: null } });
    return;
  }

  const status = typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
    ? error.status
    : 500;
  if (status >= 500) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'request_failed',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }));
  }
  const message = status === 413 ? 'The request or uploaded file is too large.' : 'An unexpected server error occurred.';
  response.status(status).json({ success: false, data: null, error: { code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR', message, details: null } });
};

export function assertFound<T>(value: T | null | undefined, message = 'The requested record was not found.'): T {
  if (value === null || value === undefined) throw new HttpError(404, 'NOT_FOUND', message);
  return value;
}