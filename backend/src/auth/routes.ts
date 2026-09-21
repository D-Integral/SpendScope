import { Router } from 'express';
import { z } from 'zod';
import passport from './passport.js';
import { config } from '../config.js';
import { githubCallbackUrl, googleCallbackUrl, publicOrigin } from '../lib/publicUrl.js';
import { requireAuth } from '../middleware/auth.js';
import { publicUser, upsertUserFromProfile } from '../services/userService.js';

const router = Router();

// Advertise which providers are configured so the UI can enable/disable buttons.
router.get('/providers', (_req, res) => {
  res.json({
    google: config.google.enabled,
    github: config.github.enabled,
    testMode: config.authTestMode,
  });
});

// --- Google ---
router.get('/google', (req, res, next) => {
  if (!config.google.enabled) {
    return res.status(503).json({ error: 'Google SSO is not configured.' });
  }
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    callbackURL: googleCallbackUrl(req),
  } as any)(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', {
    callbackURL: googleCallbackUrl(req),
    failureRedirect: `${publicOrigin(req)}/login?error=google`,
  } as any)(req, res, (err: unknown) => {
    if (err) return next(err);
    res.redirect(publicOrigin(req));
  });
});

// --- GitHub ---
router.get('/github', (req, res, next) => {
  if (!config.github.enabled) {
    return res.status(503).json({ error: 'GitHub SSO is not configured.' });
  }
  passport.authenticate('github', {
    scope: ['user:email'],
    callbackURL: githubCallbackUrl(req),
  } as any)(req, res, next);
});

router.get('/github/callback', (req, res, next) => {
  passport.authenticate('github', {
    callbackURL: githubCallbackUrl(req),
    failureRedirect: `${publicOrigin(req)}/login?error=github`,
  } as any)(req, res, (err: unknown) => {
    if (err) return next(err);
    res.redirect(publicOrigin(req));
  });
});

// --- Session helpers ---
router.get('/me', (req, res) => {
  if (req.isAuthenticated?.() && req.user) {
    return res.json({ user: publicUser(req.user as any) });
  }
  return res.status(401).json({ user: null });
});

router.post('/logout', requireAuth, (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  });
});

// --- Test-mode login (mock/stub SSO provider) ---
// Enabled only when AUTH_TEST_MODE=true or NODE_ENV=test. Lets automated tests
// and local demos exercise the "SSO success -> local user created" path without
// contacting Google/GitHub.
const testLoginSchema = z.object({
  provider: z.enum(['google', 'github']),
  providerUserId: z.string().min(1),
  email: z.string().email().nullish(),
  displayName: z.string().min(1),
  avatarUrl: z.string().url().nullish(),
});

if (config.authTestMode) {
  router.post('/test/login', async (req, res, next) => {
    const parsed = testLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid profile', details: parsed.error.flatten() });
    }
    try {
      const user = await upsertUserFromProfile(parsed.data);
      req.login(user, (err) => {
        if (err) return next(err);
        res.json({ user: publicUser(user) });
      });
    } catch (err) {
      next(err);
    }
  });
}

export default router;
