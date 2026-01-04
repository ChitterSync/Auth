import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { rotateRefreshToken } from '../../../../lib/auth/session';
import { clearRefreshCookie, REFRESH_COOKIE_NAME, setRefreshCookie } from '../../../../lib/auth/cookies';
import { getClientIp, getUserAgent } from '../../../../lib/auth/request';
import { rateLimit } from '../../../../lib/auth/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = rateLimit(`auth:refresh:${ip}`, { limit: 20, windowMs: 60_000 });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((limit.resetAt - Date.now()) / 1000).toString(),
          },
        },
      );
    }

    const refreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value ?? null;
    const result = await rotateRefreshToken(prisma, refreshToken, {
      userAgent: getUserAgent(req),
      ip,
    });

    if (result.status === 'rotated') {
      const res = NextResponse.json({ success: true }, { status: 200 });
      setRefreshCookie(res, result.refreshToken);
      return res;
    }

    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    clearRefreshCookie(res);
    return res;
  } catch (error) {
    console.error('Auth refresh failed', error);
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    clearRefreshCookie(res);
    return res;
  }
}
