import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { prisma } from '../src/prisma.js';

const backendRoot = path.dirname(fileURLToPath(new URL('.', import.meta.url)));

beforeAll(() => {
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'pipe',
    cwd: backendRoot,
    env: { ...process.env },
  });
});

beforeEach(async () => {
  await prisma.alertState.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
