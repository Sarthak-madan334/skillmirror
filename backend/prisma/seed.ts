import 'dotenv/config';
import { PrismaClient } from '../generated/client/client.js';
import { createPrismaClient } from '../src/db.js';
import bcrypt from 'bcryptjs';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required to seed the development database.');
const prisma = createPrismaClient(databaseUrl);

async function main() {
  const email = process.env.DEV_SEED_EMAIL?.trim().toLowerCase();
  const password = process.env.DEV_SEED_PASSWORD;
  if (!email || !password || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) {
    throw new Error('Set DEV_SEED_EMAIL and a unique DEV_SEED_PASSWORD of at least 12 characters before running the development seed.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const owner = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: 'Sample Instructor', email, passwordHash, role: 'INSTRUCTOR' },
    select: { id: true },
  });
  const existing = await prisma.trainingProject.findFirst({ where: { ownerId: owner.id, title: 'Build a paper bridge' } });
  if (existing) {
    console.info('Fictional paper-bridge training already exists.');
    return;
  }

  await prisma.trainingProject.create({
    data: {
      ownerId: owner.id,
      title: 'Build a paper bridge',
      description: 'Practise a simple paper bridge and reflect on how folds affect its stability.',
      category: 'Maker skills',
      level: 'Beginner',
      duration: 12,
      objectives: 'Build a stable bridge and test how its shape affects strength.',
      materials: ['2 sheets of paper', 'Masking tape', 'A few coins', 'Two sturdy books'],
      status: 'PUBLISHED',
      source: 'development-seed',
      steps: {
        create: [
          { position: 0, title: 'Set up the span', instructions: 'Place two books parallel to each other with a small gap between them.', expected: 'The books form a steady, even gap.', verification: 'Check that both book edges are level.', feedback: 'Move the books closer and check that neither rocks.' },
          { position: 1, title: 'Fold the support', instructions: 'Fold one sheet of paper back and forth into even accordion sections.', expected: 'The folded paper stands in repeating ridges.', verification: 'Compare ridge heights along the edge.', feedback: 'Refold with wider, more even sections.' },
          { position: 2, title: 'Place the bridge deck', instructions: 'Rest a second sheet across the folded support and center it over the gap.', expected: 'The top sheet reaches both book edges.', verification: 'Check that the support is centered underneath.', feedback: 'Center the support before testing again.' },
          { position: 3, title: 'Test gently', instructions: 'Add a few lightweight coins one at a time near the center. Stop if the bridge slips or bends sharply.', expected: 'The bridge spans the gap while supporting a few coins.', verification: 'Notice where the paper bends, then remove the coins.', safety: 'Keep the test low over a clear surface and use only lightweight objects.', feedback: 'Remove the coins and check the support alignment.' },
        ],
      },
    },
  });
  console.info('Created fictional paper-bridge training. No default credentials were generated.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Development seed failed.');
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});