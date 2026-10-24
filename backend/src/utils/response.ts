import type { Response } from 'express';

export function sendData<T>(response: Response, data: T, status = 200): void {
  response.status(status).json({ success: true, data, error: null });
}