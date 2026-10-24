import { createReadStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { HttpError } from '../errors.js';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
};
const MIME_TYPES: Record<string, string> = Object.fromEntries(Object.entries(EXTENSIONS).map(([mimeType, extension]) => [extension, mimeType]));
const STORAGE_KEY_PATTERN = /^[0-9a-f-]{36}\.(jpg|png|webp|mp4|mov|webm)$/i;

export class S3MediaStorage {
  readonly provider = 'S3' as const;
  readonly temporaryDirectory: string;
  private readonly client: S3Client;

  constructor(private readonly options: { bucket: string; region: string; endpoint?: string; forcePathStyle: boolean; accessKeyId: string; secretAccessKey: string; mediaStorageDir: string }) {
    this.temporaryDirectory = path.join(path.resolve(options.mediaStorageDir), 'tmp');
    this.client = new S3Client({
      region: options.region,
      ...(options.endpoint ? { endpoint: options.endpoint, forcePathStyle: options.forcePathStyle } : {}),
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    });
  }

  async prepare(): Promise<void> { await mkdir(this.temporaryDirectory, { recursive: true, mode: 0o700 }); }

  createKey(mimeType: string): string {
    const extension = EXTENSIONS[mimeType];
    if (!extension) throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Upload a supported image or video file.');
    return `${randomUUID()}.${extension}`;
  }

  private assertKey(storageKey: string): void {
    if (!STORAGE_KEY_PATTERN.test(storageKey)) throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Media was not found.');
  }

  async commit(temporaryPath: string, storageKey: string): Promise<void> {
    this.assertKey(storageKey);
    try {
      const details = await stat(temporaryPath);
      await this.client.send(new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: storageKey,
        Body: createReadStream(temporaryPath),
        ContentLength: details.size,
        ContentType: MIME_TYPES[path.extname(storageKey).slice(1)],
        CacheControl: 'private, no-store',
      }));
    } finally {
      await this.removeTemporary(temporaryPath);
    }
  }

  async remove(storageKey: string): Promise<void> {
    this.assertKey(storageKey);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: storageKey }));
  }

  async removeTemporary(temporaryPath: string): Promise<void> {
    const resolved = path.resolve(temporaryPath);
    if (!resolved.startsWith(`${this.temporaryDirectory}${path.sep}`)) return;
    await rm(resolved, { force: true });
  }

  async read(storageKey: string): Promise<Buffer> {
    this.assertKey(storageKey);
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.options.bucket, Key: storageKey }));
    if (!result.Body) throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Media was not found.');
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async openReadStream(storageKey: string, range?: { start: number; end: number }): Promise<Readable> {
    this.assertKey(storageKey);
    const result = await this.client.send(new GetObjectCommand({
      Bucket: this.options.bucket,
      Key: storageKey,
      ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}),
    }));
    if (!result.Body || !('pipe' in result.Body)) throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Media was not found.');
    return result.Body as Readable;
  }

  async getSize(storageKey: string): Promise<number> {
    this.assertKey(storageKey);
    const result = await this.client.send(new HeadObjectCommand({ Bucket: this.options.bucket, Key: storageKey }));
    if (typeof result.ContentLength !== 'number') throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Media was not found.');
    return result.ContentLength;
  }

  async checkConnection(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.options.bucket }));
  }
}
