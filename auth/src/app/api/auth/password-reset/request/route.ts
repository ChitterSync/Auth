import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { createVerificationToken } from '../../../../../lib/auth/verification';
import { getClientIp } from '../../../../../lib/auth/request';
import { rateLimit } from '../../../../../lib/auth/rateLimit';
import { logAuthEvent } from '../../../../../lib/auth/logging';
import { hashPrivateValue } from '../../../../../lib/auth/private';

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

    const loginIdHash = hashPrivateValue(normalized);
    const emailHash = hashPrivateValue(normalized.toLowerCase());
    const phoneHash = hashPrivateValue(normalized);
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { loginId: loginIdHash },
          { username: normalized },
          { emails: { contains: emailHash } },
          { phones: { contains: phoneHash } },
        ],
      },
    });

    if (user) {
      await createVerificationToken(prisma, {
        userId: user.id,
        type: 'password_reset',
        ttlMs: 1000 * 60 * 30,
      });
      logAuthEvent({ event: 'password_reset_request', userId: user.id, ip });
    }

    return genericResponse();
  } catch (error) {
    console.error('password-reset request failed', error);
    return genericResponse();
  }
}
