import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { loadConfig } from '../config/env.js';
import { createPrismaClient } from '../db.js';
import { createMediaStorage } from '../storage/createMediaStorage.js';

async function main() {
  const config = loadConfig();
  if (config.mediaStorageDriver !== 'S3') throw new Error('Set MEDIA_STORAGE_DRIVER=s3 before migrating local media.');
  const prisma = createPrismaClient(config.databaseUrl);
  const storage = createMediaStorage(config);
  await storage.prepare();
  await storage.checkConnection();
  let afterId: string | undefined;
  let migrated = 0;
  try {
    while (true) {
      const assets = await prisma.mediaAsset.findMany({
        where: { provider: 'LOCAL', ...(afterId ? { id: { gt: afterId } } : {}) },
        orderBy: { id: 'asc' },
        take: 25,
        select: { id: true, storageKey: true, sizeBytes: true },
      });
      if (!assets.length) break;
      for (const asset of assets) {
        const temporaryPath = path.join(storage.temporaryDirectory, `migration-${randomUUID()}.tmp`);
        try {
          const source = await storage.openReadStream(asset.storageKey, 'LOCAL');
          await pipeline(source, createWriteStream(temporaryPath, { flags: 'wx', mode: 0o600 }));
          if (await storage.getSize(asset.storageKey, 'LOCAL') !== asset.sizeBytes) throw new Error('Stored size did not match the database record.');
          await storage.commit(temporaryPath, asset.storageKey);
          if (await storage.getSize(asset.storageKey, 'S3') !== asset.sizeBytes) throw new Error('S3 copy size did not match the database record.');
          await prisma.mediaAsset.update({ where: { id: asset.id }, data: { provider: 'S3' } });
          await storage.remove(asset.storageKey, 'LOCAL');
          migrated += 1;
        } finally {
          await storage.removeTemporary(temporaryPath).catch(() => undefined);
        }
      }
      afterId = assets[assets.length - 1].id;
      console.info(JSON.stringify({ level: 'info', event: 'media_migration_progress', migrated }));
    }
    console.info(JSON.stringify({ level: 'info', event: 'media_migration_complete', migrated }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ level: 'error', event: 'media_migration_failed', message: error instanceof Error ? error.message : 'Unknown error' }));
  process.exitCode = 1;
});
