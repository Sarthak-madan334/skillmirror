import type { Readable } from 'node:stream';
import { HttpError } from '../errors.js';
import { LocalMediaStorage } from './localMediaStorage.js';
import { S3MediaStorage } from './s3MediaStorage.js';

export type StorageProvider = 'LOCAL' | 'S3';

export class MediaStorage {
  readonly provider: StorageProvider;
  readonly temporaryDirectory: string;

  constructor(private readonly local: LocalMediaStorage, private readonly s3?: S3MediaStorage, activeProvider: StorageProvider = 'LOCAL') {
    if (activeProvider === 'S3' && !s3) throw new Error('S3 storage is selected but is not fully configured.');
    this.provider = activeProvider;
    this.temporaryDirectory = local.temporaryDirectory;
  }

  async prepare(): Promise<void> {
    await this.local.prepare();
    if (this.s3) await this.s3.prepare();
  }

  createKey(mimeType: string): string { return this.active().createKey(mimeType); }

  async commit(temporaryPath: string, storageKey: string): Promise<void> { await this.active().commit(temporaryPath, storageKey); }

  async remove(storageKey: string, provider: StorageProvider = this.provider): Promise<void> { await this.forProvider(provider).remove(storageKey); }

  async removeTemporary(temporaryPath: string): Promise<void> { await this.local.removeTemporary(temporaryPath); }

  async removeTemporaryOlderThan(cutoff: Date): Promise<number> { return this.local.removeTemporaryOlderThan(cutoff); }

  async read(storageKey: string, provider: StorageProvider = this.provider): Promise<Buffer> { return this.forProvider(provider).read(storageKey); }

  async openReadStream(storageKey: string, provider: StorageProvider = this.provider, range?: { start: number; end: number }): Promise<Readable> { return this.forProvider(provider).openReadStream(storageKey, range); }

  async getSize(storageKey: string, provider: StorageProvider = this.provider): Promise<number> { return this.forProvider(provider).getSize(storageKey); }

  async checkConnection(): Promise<void> { await this.active().checkConnection(); }

  private active(): LocalMediaStorage | S3MediaStorage { return this.forProvider(this.provider); }

  private forProvider(provider: StorageProvider): LocalMediaStorage | S3MediaStorage {
    if (provider === 'LOCAL') return this.local;
    if (this.s3) return this.s3;
    throw new HttpError(503, 'MEDIA_STORAGE_UNAVAILABLE', 'The configured media storage provider is unavailable.');
  }
}
