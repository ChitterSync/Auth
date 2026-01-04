import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { consumeVerificationToken } from '../../../../../lib/auth/verification';
import { hashPassword } from '../../../../../lib/auth/password';
import { getClientIp } from '../../../../../lib/auth/request';
import { rateLimit } from '../../../../../lib/auth/rateLimit';

type PasswordResetConfirm = {
  identifier?: string;
  token?: string;
  password?: string;
};

const genericResponse = () =>
  NextResponse.json(
    { success: true, message: 'If the token is valid, the password was reset.' },
    { status: 200 },
  );

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = rateLimit(`auth:reset-confirm:${ip}`, { limit: 10, windowMs: 60_000 });
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

    const { identifier, token, password } = (await req.json().catch(() => ({}))) as PasswordResetConfirm;
    if (!identifier || !token || !password) {
      return genericResponse();
    }

    const record = await consumeVerificationToken(prisma, {
      identifier: identifier.trim(),
      token,
      type: 'password_reset',
    });

    if (record?.userId) {
      const passwordHash = await hashPassword(password);
      await prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
    }

    return genericResponse();
  } catch (error) {
    console.error('password-reset confirm failed', error);
    return genericResponse();
  }
}
