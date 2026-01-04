import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { consumeVerificationToken } from '../../../../../lib/auth/verification';
import { getClientIp } from '../../../../../lib/auth/request';
import { rateLimit } from '../../../../../lib/auth/rateLimit';

type VerifyEmailConfirm = {
  email?: string;
  token?: string;
};

const genericResponse = () =>
  NextResponse.json(
    { success: true, message: 'If the token is valid, the email will be verified.' },
    { status: 200 },
  );

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = rateLimit(`auth:verify-confirm:${ip}`, { limit: 10, windowMs: 60_000 });
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

    const { email, token } = (await req.json().catch(() => ({}))) as VerifyEmailConfirm;
    const normalized = email?.trim().toLowerCase();
    if (!normalized || !token) {
      return genericResponse();
    }

    const record = await consumeVerificationToken(prisma, {
      identifier: normalized,
      token,
      type: 'verify_email',
    });

    if (record?.userId) {
      await prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      });
    }

    return genericResponse();
  } catch (error) {
    console.error('verify-email confirm failed', error);
    return genericResponse();
  }
}
