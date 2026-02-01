import { NextRequest, NextResponse } from 'next/server';
import { v7 as uuidv7 } from 'uuid';
import prisma from '../../../../lib/prisma';
import { hashPassword } from '../../../../lib/auth/password';
import { createSession } from '../../../../lib/auth/session';
import { setRefreshCookie } from '../../../../lib/auth/cookies';
import { getClientIp, getUserAgent } from '../../../../lib/auth/request';
import { logAuthEvent } from '../../../../lib/auth/logging';
import { hashPrivateValue } from '../../../../lib/auth/private';
import { rateLimit } from '../../../../lib/auth/rateLimit';

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
    const ip = getClientIp(req);
    const limit = rateLimit(`auth:register:${ip}`, { limit: 5, windowMs: 60_000 });
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

    const data: RegisterPayload = await req.json();

    const emails = sanitizeArray(data.email);
    const phones = sanitizeArray(data.phone);
    const locations = sanitizeArray(data.location);
    const loginId = data.loginId?.trim() || '';
    const username = data.username?.trim() || '';
    const password = typeof data.password === 'string' ? data.password : '';

    if (emails.length > 5 || phones.length > 5 || locations.length > 5) {
      return NextResponse.json({ error: 'Too many contact entries.' }, { status: 400 });
    }

    if (
      !loginId ||
      !password ||
      !username ||
      (!emails.length && !phones.length)
    ) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    if (loginId.length < 6 || loginId.length > 64) {
      return NextResponse.json({ error: 'Login ID must be 6-64 characters.' }, { status: 400 });
    }
    const usernamePattern = /^[A-Za-z0-9._-]{3,32}$/;
    if (!usernamePattern.test(username)) {
      return NextResponse.json(
        { error: 'Username must be 3-32 characters using letters, numbers, underscores, hyphens, or periods.' },
        { status: 400 },
      );
    }
    if (password.length < 10 || password.length > 256) {
      return NextResponse.json({ error: 'Password must be 10-256 characters.' }, { status: 400 });
    }
    if (typeof data.bio === 'string' && data.bio.length > 200) {
      return NextResponse.json({ error: 'Bio is too long.' }, { status: 400 });
    }

    if (emails.some((email) => email.split('@')[0]?.includes('+'))) {
      return NextResponse.json({ error: 'Email forwarding is not allowed.' }, { status: 400 });
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

    const passwordHash = await hashPassword(password);
    const created = await prisma.user.create({
      data: {
        id: uuidv7(),
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
