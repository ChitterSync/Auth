import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { verifyPassword } from '../../../../lib/auth/password';
import { createSession } from '../../../../lib/auth/session';
import { setRefreshCookie } from '../../../../lib/auth/cookies';
import { getClientIp, getUserAgent } from '../../../../lib/auth/request';
import { rateLimit } from '../../../../lib/auth/rateLimit';
import { logAuthEvent } from '../../../../lib/auth/logging';
import { hashPrivateValue } from '../../../../lib/auth/private';

type LoginPayload = {
  identifier?: string;
  password?: string;
};

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = rateLimit(`auth:login:${ip}`, { limit: 10, windowMs: 60_000 });
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

    const { identifier, password } = (await req.json().catch(() => ({}))) as LoginPayload;
    const trimmedIdentifier = identifier?.trim();
    if (!trimmedIdentifier || !password) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const loginIdHash = hashPrivateValue(trimmedIdentifier);
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ loginId: loginIdHash }, { username: trimmedIdentifier }],
      },
    });

    if (!user?.passwordHash) {
      logAuthEvent({ event: 'login_failed', userId: user?.id ?? null, ip, userAgent: getUserAgent(req) });
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      logAuthEvent({ event: 'login_failed', userId: user.id, ip, userAgent: getUserAgent(req) });
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const { refreshToken } = await createSession(prisma, user.id, {
      userAgent: getUserAgent(req),
      ip,
    });

    const res = NextResponse.json({ userId: user.id }, { status: 200 });
    setRefreshCookie(res, refreshToken);
    logAuthEvent({ event: 'login', userId: user.id, ip, userAgent: getUserAgent(req) });
    return res;
  } catch (error) {
    console.error('Auth login failed', error);
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
  }
}
