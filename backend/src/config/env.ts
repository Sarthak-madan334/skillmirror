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
  MEDIA_STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  MEDIA_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(365),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('false'),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_MODEL: z.string().min(1).default('qwen/qwen3.8-27b'),
});

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  frontendOrigin: string;
  mediaStorageDir: string;
  mediaStorageDriver: 'LOCAL' | 'S3';
  mediaRetentionDays: number;
  s3Endpoint?: string;
  s3Region: string;
  s3ForcePathStyle: boolean;
  s3Bucket?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  groqApiKey?: string;
  groqModel: string;
};

export function loadConfig(values: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.superRefine((environment, context) => {
    if (environment.MEDIA_STORAGE_DRIVER === 's3') {
      for (const key of ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const) {
        if (!environment[key]) context.addIssue({ code: 'custom', path: [key], message: 'Required when MEDIA_STORAGE_DRIVER=s3' });
      }
    }
  }).safeParse(values);
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
    mediaStorageDriver: parsed.data.MEDIA_STORAGE_DRIVER.toUpperCase() as 'LOCAL' | 'S3',
    mediaRetentionDays: parsed.data.MEDIA_RETENTION_DAYS,
    s3Endpoint: parsed.data.S3_ENDPOINT,
    s3Region: parsed.data.S3_REGION,
    s3ForcePathStyle: parsed.data.S3_FORCE_PATH_STYLE === 'true',
    s3Bucket: parsed.data.S3_BUCKET,
    s3AccessKeyId: parsed.data.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: parsed.data.S3_SECRET_ACCESS_KEY,
    groqApiKey: parsed.data.GROQ_API_KEY,
    groqModel: parsed.data.GROQ_MODEL,
  };
}
