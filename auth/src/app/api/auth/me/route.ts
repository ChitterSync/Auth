import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getSessionFromRefreshToken } from '../../../../lib/auth/session';
import { clearRefreshCookie, REFRESH_COOKIE_NAME } from '../../../../lib/auth/cookies';

export async function GET(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value ?? null;
    const session = await getSessionFromRefreshToken(prisma, refreshToken);
    if (!session) {
      const res = NextResponse.json({ authenticated: false, provider: null, user: null }, { status: 200 });
      res.headers.set('Cache-Control', 'no-store');
      if (refreshToken) clearRefreshCookie(res);
      return res;
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, username: true, name: true },
    });

    const res = NextResponse.json(
      {
        authenticated: Boolean(user),
        provider: user ? 'chittersync' : null,
        user: user
          ? { id: user.id, username: user.username, displayName: user.name ?? user.username }
          : null,
      },
      { status: 200 },
    );
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (error) {
    console.error('Auth me failed', error);
    const res = NextResponse.json({ authenticated: false, provider: null, user: null }, { status: 200 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }
}
