import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../src/prisma.js';

export interface TestProfile {
  provider: 'google' | 'github';
  providerUserId: string;
  email?: string | null;
  displayName: string;
  avatarUrl?: string | null;
}

export type TestAgent = ReturnType<typeof request.agent>;

export function cookieFromResponse(res: { headers: { [key: string]: unknown } }): string {
  const raw = res.headers['set-cookie'];
  const parts = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  return parts.map((entry) => String(entry).split(';')[0]).join('; ');
}

export async function loginAgent(app: Express, profile: TestProfile) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/test/login').send({
    provider: profile.provider,
    providerUserId: profile.providerUserId,
    email: profile.email ?? null,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl ?? null,
  });
  if (res.status !== 200) {
    throw new Error(`Test login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    agent,
    user: res.body.user as { id: string; displayName: string; email: string | null; provider: string },
    cookie: cookieFromResponse(res),
  };
}

export const alice: TestProfile = {
  provider: 'google',
  providerUserId: 'google-alice',
  email: 'alice@example.com',
  displayName: 'Alice Example',
  avatarUrl: 'https://example.com/alice.png',
};

export const bob: TestProfile = {
  provider: 'github',
  providerUserId: 'github-bob',
  email: null,
  displayName: 'Bob Example',
};

export async function createCategory(agent: TestAgent, name: string) {
  const res = await agent.post('/api/categories').send({ name }).expect(201);
  return res.body as { id: string; name: string };
}

export { prisma };
