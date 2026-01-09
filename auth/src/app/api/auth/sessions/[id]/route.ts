import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { getSessionFromRefreshToken } from '../../../../../lib/auth/session';
import { REFRESH_COOKIE_NAME } from '../../../../../lib/auth/cookies';
import { getClientIp, getUserAgent } from '../../../../../lib/auth/request';
import { logAuthEvent } from '../../../../../lib/auth/logging';

export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  try {
    const refreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value ?? null;
    const session = await getSessionFromRefreshToken(prisma, refreshToken);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const targetId = context.params.id;
    const target = await prisma.session.findFirst({
      where: { id: targetId, userId: session.userId },
    });

    if (!target) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.session.update({
      where: { id: target.id },
      data: { revokedAt: new Date() },
    });

    logAuthEvent({
      event: 'session_revoke',
      userId: session.userId,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      metadata: { sessionId: target.id },
    });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('sessions delete failed', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
