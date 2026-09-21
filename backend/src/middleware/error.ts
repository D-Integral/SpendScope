import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A record with this value already exists.' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Record not found.' });
    }
  }

  const message = err instanceof Error ? err.message : 'Unexpected error';
  console.error(err);
  res.status(500).json({ error: 'Internal server error', message });
}
