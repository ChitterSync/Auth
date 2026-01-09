import { NextRequest, NextResponse } from 'next/server';
import { v6 as uuidv6 } from 'uuid';
import prisma from '../../../../lib/prisma';
import { hashPassword } from '../../../../lib/auth/password';
import { createSession } from '../../../../lib/auth/session';
import { setRefreshCookie } from '../../../../lib/auth/cookies';
import { getClientIp, getUserAgent } from '../../../../lib/auth/request';
import { logAuthEvent } from '../../../../lib/auth/logging';
import { hashPrivateValue } from '../../../../lib/auth/private';

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

const normalizeLoginId = (value: string) => value.trim();
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizePhone = (value: string) => value.trim();

export async function POST(req: NextRequest) {
  try {
    const data: RegisterPayload = await req.json();

    const emails = sanitizeArray(data.email);
    const phones = sanitizeArray(data.phone);
    const locations = sanitizeArray(data.location);
    const loginId = data.loginId?.trim() || '';
    const username = data.username?.trim() || '';

    if (
      !loginId ||
      !data.password ||
      !username ||
      (!emails.length && !phones.length)
    ) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const loginIdHash = hashPrivateValue(normalizeLoginId(loginId));
    const emailHashes = emails.map(normalizeEmail).map(hashPrivateValue);
    const phoneHashes = phones.map(normalizePhone).map(hashPrivateValue);

    const [existingByLogin, existingByUsername] = await Promise.all([
      prisma.user.findUnique({ where: { loginId: loginIdHash } }),
      prisma.user.findUnique({ where: { username } }),
    ]);

    if (existingByLogin || existingByUsername) {
      return NextResponse.json({ error: 'Account already exists.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(data.password);
    const created = await prisma.user.create({
      data: {
        id: uuidv6(),
        loginId: loginIdHash,
        username,
        passwordHash,
        emails: serializeList(emailHashes),
        phones: serializeList(phoneHashes),
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
    logAuthEvent({
      event: 'register',
      userId: created.id,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });
    return res;
  } catch (error) {
    console.error('Auth register failed', error);
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
}
