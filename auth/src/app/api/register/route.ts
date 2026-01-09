import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { hashPassword } from '../../../lib/auth/password';
import { v6 as uuidv6 } from 'uuid';
import { hashPrivateValue } from '../../../lib/auth/private';

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
  userId?: string;
};

interface R2Bucket {
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ objects: { key: string }[] }>;
}

function getR2(): R2Bucket {
  const envUnknown = globalThis as unknown as { env?: { r7105_cs?: R2Bucket } };
  if (envUnknown.env && envUnknown.env.r7105_cs) {
    return envUnknown.env.r7105_cs;
  }
  const globalWithMock = globalThis as unknown as { _mockR2Store?: Record<string, string> };
  if (!globalWithMock._mockR2Store) {
    globalWithMock._mockR2Store = {};
  }
  const store = globalWithMock._mockR2Store;
  return {
    async get(key: string) {
      if (store[key] !== undefined) {
        return {
          async text() {
            return store[key];
          },
        };
      }
      return null;
    },
    async put(key: string, value: string) {
      store[key] = value;
    },
    async delete(key: string) {
      delete store[key];
    },
    async list(options?: { prefix?: string }) {
      const prefix = options?.prefix || '';
      return {
        objects: Object.keys(store)
          .filter((key) => key.startsWith(prefix))
          .map((key) => ({ key })),
      };
    },
  };
}

const sanitizeArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry): entry is string => Boolean(entry));
};

const sanitizeString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const serializeList = (values: string[]) => (values.length ? JSON.stringify(values) : null);

const serializeMetadata = (metadata: Record<string, unknown> | null) =>
  metadata ? JSON.stringify(metadata) : null;

const normalizeLoginId = (value: string) => value.trim();
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizePhone = (value: string) => value.trim();

const parseR2Value = async (valuePromise: Promise<{ text(): Promise<string> } | null>) => {
  const record = await valuePromise;
  if (!record) return null;
  try {
    return await record.text();
  } catch {
    return null;
  }
};

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

    if (!process.env.DATABASE_URL) {
      const r2 = getR2();
      const loginKey = `loginIdHash:${loginIdHash}`;
      const usernameKey = `username:${username}`;
      const [existingLogin, existingUsername] = await Promise.all([
        parseR2Value(r2.get(loginKey)),
        parseR2Value(r2.get(usernameKey)),
      ]);
      if (existingLogin) {
        return NextResponse.json({ error: 'Login ID already exists.' }, { status: 409 });
      }
      if (existingUsername) {
        return NextResponse.json({ error: 'Username already exists.' }, { status: 409 });
      }

      const userId = uuidv6();
      const passwordHash = await hashPassword(data.password);
      const userRecord = {
        userId,
        loginIdHash,
        passwordHash,
        emailHashes,
        phoneHashes,
        username,
        name: sanitizeString(data.name),
        gender: sanitizeString(data.gender),
        dob: data.dob,
        location: locations,
        pronouns: sanitizeString(data.pronouns),
        bio: sanitizeString(data.bio),
        website: sanitizeString(data.website),
        tosAgreement: Boolean(data.tosAgreement),
        metadata: data.userId ? { clientProvidedId: data.userId } : null,
        createdAt: new Date().toISOString(),
      };

      await r2.put(`user:${userId}`, JSON.stringify(userRecord));
      await r2.put(loginKey, userId);
      await r2.put(usernameKey, userId);
      return NextResponse.json({ userId }, { status: 201 });
    }

    const [existingByLogin, existingByUsername] = await Promise.all([
      prisma.user.findUnique({ where: { loginId: loginIdHash } }),
      prisma.user.findUnique({ where: { username } }),
    ]);

    if (existingByLogin) {
      return NextResponse.json({ error: 'Login ID already exists.' }, { status: 409 });
    }
    if (existingByUsername) {
      return NextResponse.json({ error: 'Username already exists.' }, { status: 409 });
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
        metadata: serializeMetadata(data.userId ? { clientProvidedId: data.userId } : null),
      },
    });

    return NextResponse.json({ userId: created.id }, { status: 201 });
  } catch (error) {
    console.error('Registration failed', error);
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
}
