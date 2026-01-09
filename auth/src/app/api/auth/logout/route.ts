import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { clearRefreshCookie, REFRESH_COOKIE_NAME } from '../../../../lib/auth/cookies';
import { getSessionFromRefreshToken } from '../../../../lib/auth/session';
import { getClientIp, getUserAgent } from '../../../../lib/auth/request';
import { logAuthEvent } from '../../../../lib/auth/logging';

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value ?? null;
    const session = await getSessionFromRefreshToken(prisma, refreshToken);

    if (session) {
      await prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      logAuthEvent({
        event: 'logout',
        userId: session.userId,
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
      });
    }

    const res = NextResponse.json({ success: true }, { status: 200 });
    clearRefreshCookie(res);
    return res;
  } catch (error) {
    console.error('Auth logout failed', error);
    const res = NextResponse.json({ success: true }, { status: 200 });
    clearRefreshCookie(res);
    return res;
  }
}
