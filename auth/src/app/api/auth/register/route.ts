import { NextRequest, NextResponse } from 'next/server';
import { v6 as uuidv6 } from 'uuid';
import prisma from '../../../../lib/prisma';
import { hashPassword } from '../../../../lib/auth/password';
import { createSession } from '../../../../lib/auth/session';
import { setRefreshCookie } from '../../../../lib/auth/cookies';
import { getClientIp, getUserAgent } from '../../../../lib/auth/request';

type RegisterPayload = {
  loginId?: string;
  password?: string;
  email?: unknown;
  phone?: unknown;
  username?: string;
  name?: string;
  gender?: string;
  dob?: string;
  location?: unknown;
  pronouns?: string;
  bio?: string;
  website?: string;
  tosAgreement?: boolean;
};

const sanitizeArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry): entry is string => Boolean(entry));
};

const sanitizeString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const serializeList = (values: string[]) => (values.length ? JSON.stringify(values) : null);

export async function POST(req: NextRequest) {
  try {
    const data: RegisterPayload = await req.json();

    const emails = sanitizeArray(data.email);
    const phones = sanitizeArray(data.phone);
    const locations = sanitizeArray(data.location);

    if (
      !data.loginId?.trim() ||
      !data.password ||
      !data.username?.trim() ||
      (!emails.length && !phones.length)
    ) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const [existingByLogin, existingByUsername] = await Promise.all([
      prisma.user.findUnique({ where: { loginId: data.loginId.trim() } }),
      prisma.user.findUnique({ where: { username: data.username.trim() } }),
    ]);

    if (existingByLogin || existingByUsername) {
      return NextResponse.json({ error: 'Account already exists.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(data.password);
    const created = await prisma.user.create({
      data: {
        id: uuidv6(),
        loginId: data.loginId.trim(),
        username: data.username.trim(),
        passwordHash,
        emails: serializeList(emails),
        phones: serializeList(phones),
        name: sanitizeString(data.name),
        gender: sanitizeString(data.gender),
        dob: data.dob ? new Date(data.dob) : null,
        locations: serializeList(locations),
        pronouns: sanitizeString(data.pronouns),
        bio: sanitizeString(data.bio),
        website: sanitizeString(data.website),
        tosAgreement: Boolean(data.tosAgreement),
      },
    });

    const { refreshToken } = await createSession(prisma, created.id, {
      userAgent: getUserAgent(req),
      ip: getClientIp(req),
    });

    const res = NextResponse.json({ userId: created.id }, { status: 201 });
    setRefreshCookie(res, refreshToken);
    return res;
  } catch (error) {
    console.error('Auth register failed', error);
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
}
