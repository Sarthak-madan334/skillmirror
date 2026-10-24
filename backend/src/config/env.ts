import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv({ path: path.resolve(process.cwd(), 'backend/.env') });
loadDotenv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  DATABASE_URL: z.string().url().refine((value) => value.startsWith('postgresql://') || value.startsWith('postgres://'), 'DATABASE_URL must use PostgreSQL'),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  MEDIA_STORAGE_DIR: z.string().min(1).default('./backend/storage'),
});

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  frontendOrigin: string;
  mediaStorageDir: string;
};

export function loadConfig(values: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(values);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid backend configuration: ${missing}`);
  }

  return {
    nodeEnv: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
    databaseUrl: parsed.data.DATABASE_URL,
    frontendOrigin: parsed.data.FRONTEND_ORIGIN,
    mediaStorageDir: parsed.data.MEDIA_STORAGE_DIR,
  };
}