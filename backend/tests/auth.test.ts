import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { alice, bob, loginAgent, prisma } from './helpers.js';

const { app } = createApp();

describe('SSO login (mock provider)', () => {
  it('creates a local user on first Google sign-in and persists the session', async () => {
    const { agent, user } = await loginAgent(app, alice);

    expect(user).toMatchObject({
      displayName: 'Alice Example',
    });
    expect(user.id).toBeTruthy();

    const stored = await prisma.user.findFirst({
      where: { provider: 'google', providerUserId: 'google-alice' },
    });
    expect(stored).toMatchObject({
      provider: 'google',
      providerUserId: 'google-alice',
      email: 'alice@example.com',
      displayName: 'Alice Example',
      avatarUrl: 'https://example.com/alice.png',
    });

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user.id).toBe(user.id);
    expect(me.body.user.email).toBe('alice@example.com');
    expect(me.body.user.provider).toBe('google');
    expect(me.body.user.avatarUrl).toBe('https://example.com/alice.png');
  });

  it('creates a GitHub user without email (identity is provider + provider_user_id)', async () => {
    const { agent, user } = await loginAgent(app, bob);
    expect(user.displayName).toBe('Bob Example');

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user.email).toBeNull();
    expect(me.body.user.provider).toBe('github');

    const stored = await prisma.user.findFirst({
      where: { provider: 'github', providerUserId: 'github-bob' },
    });
    expect(stored?.email).toBeNull();
    expect(stored?.providerUserId).toBe('github-bob');
  });

  it('treats the same person on Google vs GitHub as separate accounts', async () => {
    await loginAgent(app, {
      provider: 'google',
      providerUserId: 'shared-person',
      email: 'same@example.com',
      displayName: 'Same Person',
    });
    await loginAgent(app, {
      provider: 'github',
      providerUserId: 'shared-person',
      email: 'same@example.com',
      displayName: 'Same Person',
    });

    const users = await prisma.user.findMany({ where: { email: 'same@example.com' } });
    expect(users).toHaveLength(2);
  });

  it('logs out and clears the session', async () => {
    const { agent } = await loginAgent(app, alice);
    await agent.post('/api/auth/logout').expect(200);
    await agent.get('/api/auth/me').expect(401);
  });
});
