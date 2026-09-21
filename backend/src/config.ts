import dotenv from 'dotenv';

dotenv.config();

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isTest: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT ?? 4000),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-insecure-session-secret-change-me',

  // Single app currency for the MVP (shown explicitly in the UI).
  currency: process.env.CURRENCY ?? 'USD',

  // When enabled, exposes POST /api/auth/test/login for tests / local demos.
  // Automatically enabled in the "test" environment.
  authTestMode: bool(process.env.AUTH_TEST_MODE) || process.env.NODE_ENV === 'test',

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:4000/api/auth/google/callback',
    get enabled() {
      return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    },
  },

  github: {
    clientId: process.env.GITHUB_CLIENT_ID ?? '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    callbackUrl:
      process.env.GITHUB_CALLBACK_URL ?? 'http://localhost:4000/api/auth/github/callback',
    get enabled() {
      return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
    },
  },
};

export const THRESHOLDS = [50, 80, 100] as const;
export type Threshold = (typeof THRESHOLDS)[number];
