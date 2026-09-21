import type { Request } from 'express';
import { config } from '../config.js';

/** Public origin of this request (honours Render / custom-domain proxies). */
export function publicOrigin(req: Request): string {
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'https')
    .split(',')[0]
    .trim();
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '')
    .split(',')[0]
    .trim();
  if (host) return `${proto}://${host}`;
  return config.clientUrl;
}

export function googleCallbackUrl(req: Request): string {
  return process.env.GOOGLE_CALLBACK_URL ?? `${publicOrigin(req)}/api/auth/google/callback`;
}

export function githubCallbackUrl(req: Request): string {
  return process.env.GITHUB_CALLBACK_URL ?? `${publicOrigin(req)}/api/auth/github/callback`;
}
