import type { NextFunction, Request, Response } from 'express';

export interface AuthedUser {
  id: string;
  provider: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}

/** Rejects unauthenticated requests with a clear 401. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated?.() && req.user) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
}

/** Convenience accessor for the authenticated user id. */
export function currentUserId(req: Request): string {
  return (req.user as AuthedUser).id;
}
