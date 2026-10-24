import type { AppConfig } from '../config/env.js';
import { LocalMediaStorage } from './localMediaStorage.js';
import { MediaStorage } from './mediaStorage.js';
import { S3MediaStorage } from './s3MediaStorage.js';

export function createMediaStorage(config: AppConfig): MediaStorage {
  const local = new LocalMediaStorage(config.mediaStorageDir);
  const s3 = config.s3Bucket && config.s3AccessKeyId && config.s3SecretAccessKey
    ? new S3MediaStorage({
      bucket: config.s3Bucket,
      region: config.s3Region,
      ...(config.s3Endpoint ? { endpoint: config.s3Endpoint } : {}),
      forcePathStyle: config.s3ForcePathStyle,
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey,
      mediaStorageDir: config.mediaStorageDir,
    })
    : undefined;
  return new MediaStorage(local, s3, config.mediaStorageDriver);
}
