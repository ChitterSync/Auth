import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { createVerificationToken } from '../../../../../lib/auth/verification';
import { getClientIp } from '../../../../../lib/auth/request';
import { rateLimit } from '../../../../../lib/auth/rateLimit';
import { logAuthEvent } from '../../../../../lib/auth/logging';
import { hashPrivateValue } from '../../../../../lib/auth/private';

type VerifyEmailRequest = {
  email?: string;
};

const genericResponse = () =>
  NextResponse.json(
    { success: true, message: 'If an account exists, a verification email will be sent.' },
    { status: 200 },
  );

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = rateLimit(`auth:verify-request:${ip}`, { limit: 5, windowMs: 60_000 });
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

    const { email } = (await req.json().catch(() => ({}))) as VerifyEmailRequest;
    const normalized = email?.trim().toLowerCase();
    if (!normalized) {
      return genericResponse();
    }

    const emailHash = hashPrivateValue(normalized);
    const user = await prisma.user.findFirst({
      where: {
        emails: { contains: emailHash },
      },
    });

    if (user) {
      await createVerificationToken(prisma, {
        userId: user.id,
        type: 'verify_email',
        ttlMs: 1000 * 60 * 30,
      });
      logAuthEvent({ event: 'verify_email_request', userId: user.id, ip });
    }

    return genericResponse();
  } catch (error) {
    console.error('verify-email request failed', error);
    return genericResponse();
  }
}
