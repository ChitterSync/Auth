import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { clearRefreshCookie, REFRESH_COOKIE_NAME } from '../../../../lib/auth/cookies';
import { parseRefreshToken } from '../../../../lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value ?? null;
    const parsed = parseRefreshToken(refreshToken);

    if (parsed) {
      await prisma.session.updateMany({
        where: { id: parsed.sessionId },
        data: { revokedAt: new Date() },
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
