import { z } from 'zod';

const idSchema = z.string().min(1).max(64);
const boundedText = (maximum: number) => z.string().trim().max(maximum);

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128)
    .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be no more than 72 UTF-8 bytes for bcrypt.')
    .refine((value) => /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value), 'Use at least 12 characters with upper-case, lower-case, and a number.'),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128)
    .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be no more than 72 UTF-8 bytes for bcrypt.'),
});

export const stepInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  instructions: z.string().trim().min(1).max(2000),
  expected: boundedText(1000).default(''),
  verification: boundedText(1000).default(''),
  safety: boundedText(1000).default(''),
  image: z.union([z.string().url().max(2048), z.literal('')]).default(''),
  feedback: boundedText(1000).default(''),
});

export const createTrainingSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1000),
  category: z.string().trim().min(1).max(80).default('Other'),
  level: z.string().trim().min(1).max(40).default('Beginner'),
  duration: z.number().int().min(1).max(600).default(15),
  objectives: boundedText(500).default(''),
  materials: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  status: z.enum(['draft', 'published']).default('draft'),
  demonstration: z.object({ mode: z.enum(['sample', 'local']), name: z.string().trim().min(1).max(255) }).nullable().default(null),
  steps: z.array(stepInputSchema).max(50).default([]),
});

export const updateTrainingSchema = createTrainingSchema.omit({ steps: true }).partial().extend({
  status: z.enum(['draft', 'published', 'archived']).optional(),
}).refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update.');

export const updateStepSchema = stepInputSchema.partial().refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update.');

export const reorderStepsSchema = z.object({ stepIds: z.array(idSchema).min(1).max(50).refine((ids) => new Set(ids).size === ids.length, 'Step IDs must be unique.') });

export const listTrainingsSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

export const sessionProgressSchema = z.object({
  currentPosition: z.number().int().min(0).max(49),
  status: z.enum(['IN_PROGRESS', 'PAUSED']).optional(),
});

export const submitAttemptSchema = z.object({
  evidenceIds: z.array(idSchema).max(5).default([]),
});

export const reviewAttemptSchema = z.object({
  status: z.enum(['PASSED', 'NEEDS_IMPROVEMENT', 'UNABLE_TO_VERIFY']),
  feedback: z.string().trim().min(1).max(2000),
});

export const generationSchema = z.object({ mode: z.literal('demo') });

export const routeIdSchema = z.object({ id: idSchema });
export const nestedRouteSchema = z.object({ trainingId: idSchema, stepId: idSchema.optional() });
export const sessionRouteSchema = z.object({ sessionId: idSchema, stepId: idSchema.optional(), attemptId: idSchema.optional() });

export const organizationQuerySchema = z.object({ organizationId: idSchema });

export const createOrganizationSchema = z.object({ name: z.string().trim().min(2).max(120) });

export const listWorkersSchema = z.object({
  organizationId: idSchema,
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const createWorkerSchema = z.object({
  organizationId: idSchema,
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  employeeId: z.string().trim().min(1).max(80),
  department: boundedText(100).default(''),
});

export const acceptWorkerInvitationSchema = z.object({ token: z.string().min(32).max(128) });

export const ownerTrainingSchema = createTrainingSchema.extend({ organizationId: idSchema });

export const createAssignmentSchema = z.object({
  organizationId: idSchema,
  trainingId: idSchema,
  workerProfileIds: z.array(idSchema).min(1).max(100),
  competencyIds: z.array(idSchema).max(50).default([]),
  dueAt: z.coerce.date().nullable().optional(),
  requiresOwnerApproval: z.boolean().default(true),
}).refine((input) => new Set(input.workerProfileIds).size === input.workerProfileIds.length, 'Worker profile IDs must be unique.')
  .refine((input) => new Set(input.competencyIds).size === input.competencyIds.length, 'Competency IDs must be unique.');

export const createCompetencySchema = z.object({
  organizationId: idSchema,
  trainingId: idSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1000),
  requiredStepIds: z.array(idSchema).min(1).max(50),
  reassessmentDays: z.number().int().min(1).max(3650).nullable().default(null),
}).refine((input) => new Set(input.requiredStepIds).size === input.requiredStepIds.length, 'Step IDs must be unique.');

export const updateAssignmentSchema = z.object({
  dueAt: z.coerce.date().nullable().optional(),
  status: z.enum(['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'NEEDS_IMPROVEMENT', 'PASSED', 'APPROVED']).optional(),
}).refine((input) => Object.keys(input).length > 0, 'Provide at least one field to update.');

export const approveCompetencySchema = z.object({
  organizationId: idSchema,
  workerProfileId: idSchema,
  feedback: boundedText(2000).default(''),
});

export const ownerReportQuerySchema = z.object({
  organizationId: idSchema,
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  department: z.string().trim().max(100).optional(),
});