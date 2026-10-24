import type { PrismaClient } from '../../generated/client/client.js';
import { MediaStorage } from '../storage/mediaStorage.js';

const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const BATCH_SIZE = 100;

export function startMediaRetentionJob(prisma: PrismaClient, storage: MediaStorage, retentionDays: number): () => void {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    let deleted = 0;
    let failures = 0;
    try {
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      while (true) {
        const expired = await prisma.mediaAsset.findMany({
          where: { createdAt: { lt: cutoff } },
          orderBy: { createdAt: 'asc' },
          take: BATCH_SIZE,
          select: { id: true, storageKey: true, provider: true },
        });
        if (!expired.length) break;
        for (const asset of expired) {
          try {
            await storage.remove(asset.storageKey, asset.provider);
            await prisma.mediaAsset.delete({ where: { id: asset.id } });
            deleted += 1;
          } catch {
            failures += 1;
          }
        }
        if (failures) break;
        if (expired.length < BATCH_SIZE) break;
      }
      const staleTemporaryFiles = await storage.removeTemporaryOlderThan(new Date(Date.now() - 24 * 60 * 60 * 1000));
      console.info(JSON.stringify({ level: failures ? 'warn' : 'info', event: 'media_retention_sweep', deleted, failures, staleTemporaryFiles, retentionDays }));
    } catch {
      console.error(JSON.stringify({ level: 'error', event: 'media_retention_sweep_failed' }));
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(() => { void run(); }, SWEEP_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
