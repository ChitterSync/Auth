import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { getSessionFromRefreshToken } from '../../../../lib/auth/session';
import { clearRefreshCookie, REFRESH_COOKIE_NAME } from '../../../../lib/auth/cookies';

export async function GET(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value ?? null;
    const session = await getSessionFromRefreshToken(prisma, refreshToken);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessions = await prisma.session.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      {
        currentSessionId: session.id,
        sessions: sessions.map((item) => ({
          id: item.id,
          userAgent: item.userAgent,
          ip: item.ip,
          lastSeenAt: item.lastSeenAt,
          createdAt: item.createdAt,
          revokedAt: item.revokedAt,
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('sessions GET failed', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value ?? null;
    const session = await getSessionFromRefreshToken(prisma, refreshToken);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.session.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const res = NextResponse.json({ success: true }, { status: 200 });
    clearRefreshCookie(res);
    return res;
  } catch (error) {
    console.error('sessions DELETE failed', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
