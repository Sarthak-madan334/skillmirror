import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from '../errors.js';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

const STORAGE_KEY_PATTERN = /^[0-9a-f-]{36}\.(jpg|png|webp|mp4|mov|webm)$/i;

export class LocalMediaStorage {
  readonly root: string;
  readonly temporaryDirectory: string;
  readonly assetDirectory: string;

  constructor(root: string) {
    this.root = path.resolve(root);
    this.temporaryDirectory = path.join(this.root, 'tmp');
    this.assetDirectory = path.join(this.root, 'assets');
  }

  async prepare(): Promise<void> {
    await Promise.all([
      mkdir(this.temporaryDirectory, { recursive: true, mode: 0o700 }),
      mkdir(this.assetDirectory, { recursive: true, mode: 0o700 }),
    ]);
  }

  createKey(mimeType: string): string {
    const extension = EXTENSIONS[mimeType];
    if (!extension) throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Upload a supported image or video file.');
    return `${randomUUID()}.${extension}`;
  }

  resolveKey(storageKey: string): string {
    if (!STORAGE_KEY_PATTERN.test(storageKey)) throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Media was not found.');
    const resolved = path.resolve(this.assetDirectory, storageKey);
    if (!resolved.startsWith(`${this.assetDirectory}${path.sep}`)) throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Media was not found.');
    return resolved;
  }

  async commit(temporaryPath: string, storageKey: string): Promise<string> {
    const finalPath = this.resolveKey(storageKey);
    await rename(temporaryPath, finalPath);
    return finalPath;
  }

  async remove(storageKey: string): Promise<void> {
    await rm(this.resolveKey(storageKey), { force: true });
  }

  async removeTemporary(temporaryPath: string): Promise<void> {
    const resolved = path.resolve(temporaryPath);
    if (!resolved.startsWith(`${this.temporaryDirectory}${path.sep}`)) return;
    await rm(resolved, { force: true });
  }

  async getSize(storageKey: string): Promise<number> {
    return (await stat(this.resolveKey(storageKey))).size;
  }
}

export const ALLOWED_MEDIA_TYPES = new Set(Object.keys(EXTENSIONS));
export const MAX_MEDIA_SIZE_BYTES = 250 * 1024 * 1024;