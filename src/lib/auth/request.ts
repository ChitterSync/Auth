import type { NextRequest } from 'next/server';

export const getClientIp = (req: NextRequest) => {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return req.headers.get('x-real-ip') || (req as { ip?: string }).ip || 'unknown';
};

export const getUserAgent = (req: NextRequest) => req.headers.get('user-agent') || null;
