import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

loadDotenv({ path: path.resolve(process.cwd(), 'backend/.env') });
loadDotenv();

export default defineConfig({
  schema: 'backend/prisma/schema.prisma',
  migrations: {
    path: 'backend/prisma/migrations',
    seed: 'tsx backend/prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});