import { loadConfig } from './config/env.js';
import { createPrismaClient } from './db.js';
import { createApp } from './app.js';
import { LocalMediaStorage } from './storage/localMediaStorage.js';

async function main() {
  const config = loadConfig();
  const prisma = createPrismaClient(config.databaseUrl);
  const storage = new LocalMediaStorage(config.mediaStorageDir);
  await storage.prepare();
  const app = createApp({ config, prisma, storage });
  const server = app.listen(config.port, () => {
    console.info(JSON.stringify({ level: 'info', event: 'server_started', port: config.port, environment: config.nodeEnv }));
  });

  const shutdown = (signal: string) => {
    console.info(JSON.stringify({ level: 'info', event: 'server_shutdown', signal }));
    server.close(() => { void prisma.$disconnect().finally(() => process.exit(0)); });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ level: 'error', event: 'server_start_failed', message: error instanceof Error ? error.message : 'Unknown startup error' }));
  process.exitCode = 1;
});