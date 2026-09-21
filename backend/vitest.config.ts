import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false,
    pool: 'forks',
    maxWorkers: 1,
    testTimeout: 20000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./prisma/test.db',
      AUTH_TEST_MODE: 'true',
      SESSION_SECRET: 'test-session-secret',
      CURRENCY: 'USD',
      CLIENT_URL: 'http://localhost:5173',
    },
  },
});
