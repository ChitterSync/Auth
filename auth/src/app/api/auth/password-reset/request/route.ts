import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { createVerificationToken } from '../../../../../lib/auth/verification';
import { getClientIp } from '../../../../../lib/auth/request';
import { rateLimit } from '../../../../../lib/auth/rateLimit';

type PasswordResetRequest = {
  identifier?: string;
};

const genericResponse = () =>
  NextResponse.json(
    { success: true, message: 'If an account exists, a reset link will be sent.' },
    { status: 200 },
  );

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = rateLimit(`auth:reset-request:${ip}`, { limit: 5, windowMs: 60_000 });
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

    const { identifier } = (await req.json().catch(() => ({}))) as PasswordResetRequest;
    const normalized = identifier?.trim();
    if (!normalized) {
      return genericResponse();
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ loginId: normalized }, { username: normalized }, { emails: { contains: normalized } }],
      },
    });

    if (user) {
      await createVerificationToken(prisma, {
        userId: user.id,
        identifier: normalized,
        type: 'password_reset',
        ttlMs: 1000 * 60 * 30,
      });
    }

    return genericResponse();
  } catch (error) {
    console.error('password-reset request failed', error);
    return genericResponse();
  }
}
