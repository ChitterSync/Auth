import { NextRequest, NextResponse } from 'next/server';
import { v6 as uuidv6 } from 'uuid';
import prisma from '../../../../lib/prisma';
import { hashPassword } from '../../../../lib/auth/password';
import { hashPrivateValue } from '../../../../lib/auth/private';

type LegacyProfile = {
  username: string;
  password?: string;
  emails?: string[];
  phones?: string[];
  name?: string;
  gender?: string;
  dob?: string;
  locations?: string[];
  pronouns?: string;
  bio?: string;
  website?: string;
  metadata?: Record<string, unknown>;
};

type MergeOptions = {
  overwritePassword?: boolean;
  copyProfileFields?: boolean;
  copyContact?: boolean;
  copyLocation?: boolean;
  legacyDisposition?: 'preserve' | 'archive' | 'delete';
  keepLegacyLoginActive?: boolean;
  note?: string;
};

type MergePayload = {
  legacy: LegacyProfile;
  operation?: 'merge' | 'create';
  targetUsername?: string;
  targetLoginId?: string;
  newLoginId?: string;
  newUsername?: string;
  options?: MergeOptions;
};

const mergeUnique = (current: string[] | null | undefined, incoming: string[] | null | undefined) => {
  const map = new Map<string, true>();
  (current || []).forEach((value) => {
    if (value) map.set(value, true);
  });
  (incoming || []).forEach((value) => {
    if (value) map.set(value, true);
  });
  return Array.from(map.keys());
};

const sanitizeArray = (arr?: string[] | null) =>
  (arr || [])
    .map((value) => (value || '').trim())
    .filter(Boolean);

const sanitizeString = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const parseStoredList = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((entry) => (typeof entry === 'string' ? entry.trim() : '')).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => (typeof entry === 'string' ? entry.trim() : '')).filter(Boolean);
      }
    } catch {
      return [];
    }
  }
  return [];
};

const serializeList = (values: string[]) => (values.length ? JSON.stringify(values) : null);

const normalizeLoginId = (value: string) => value.trim();
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizePhone = (value: string) => value.trim();

const parseMetadata = (value: unknown): Record<string, unknown> => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object') return value as Record<string, unknown>;
  return {};
};

const serializeMetadata = (value: Record<string, unknown>) => (Object.keys(value).length ? JSON.stringify(value) : null);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MergePayload;
    const { legacy, operation = 'merge', targetUsername, targetLoginId, newLoginId, newUsername } = body;
    const options: MergeOptions = body.options ?? {};

    if (!legacy?.username) {
      return NextResponse.json({ error: 'Legacy username is required.' }, { status: 400 });
    }

    legacy.emails = sanitizeArray(legacy.emails);
    legacy.phones = sanitizeArray(legacy.phones);
    legacy.locations = sanitizeArray(legacy.locations);

    if (operation === 'create') {
      const loginId = sanitizeString(newLoginId) || sanitizeString(legacy.username) || uuidv6();
      const username = sanitizeString(newUsername) || sanitizeString(legacy.username);
      if (!username) {
        return NextResponse.json({ error: 'A username is required to create a new account.' }, { status: 400 });
      }

      const emailHashes = (legacy.emails ?? []).map(normalizeEmail).map(hashPrivateValue);
      const phoneHashes = (legacy.phones ?? []).map(normalizePhone).map(hashPrivateValue);
      const created = await prisma.user.create({
        data: {
          id: uuidv6(),
          loginId: hashPrivateValue(normalizeLoginId(loginId)),
          username,
          passwordHash: legacy.password ? await hashPassword(legacy.password) : null,
          emails: serializeList(emailHashes),
          phones: serializeList(phoneHashes),
          name: sanitizeString(legacy.name) || username,
          gender: sanitizeString(legacy.gender),
          dob: legacy.dob ? new Date(legacy.dob) : null,
          locations: serializeList(legacy.locations ?? []),
          pronouns: sanitizeString(legacy.pronouns),
          bio: sanitizeString(legacy.bio),
          website: sanitizeString(legacy.website),
          metadata: serializeMetadata({
            ...(legacy.metadata || {}),
            legacySource: 'chitterhaven',
            legacyUsername: legacy.username,
            disposition: options.legacyDisposition || 'archive',
            note: options.note || null,
          }),
        },
      });

      return NextResponse.json({
        operation: 'create',
        user: { id: created.id, username: created.username, loginId: created.loginId },
      });
    }

    if (!targetUsername && !targetLoginId) {
      return NextResponse.json(
        { error: 'Provide targetUsername or targetLoginId to merge into an existing account.' },
        { status: 400 },
      );
    }

    const target = await prisma.user.findFirst({
      where: {
        OR: [
          targetUsername ? { username: targetUsername } : undefined,
          targetLoginId ? { loginId: hashPrivateValue(normalizeLoginId(targetLoginId)) } : undefined,
        ].filter(Boolean) as { username?: string; loginId?: string }[],
      },
    });

    if (!target) {
      return NextResponse.json(
        { error: 'Target user not found. Provide a username or loginId for an existing account.' },
        { status: 404 },
      );
    }

    const storedEmails = parseStoredList(target.emails);
    const storedPhones = parseStoredList(target.phones);
    const storedLocations = parseStoredList(target.locations);

    const legacyEmailHashes = (legacy.emails ?? []).map(normalizeEmail).map(hashPrivateValue);
    const legacyPhoneHashes = (legacy.phones ?? []).map(normalizePhone).map(hashPrivateValue);
    const mergedEmails = options.copyContact !== false
      ? mergeUnique(storedEmails, legacyEmailHashes)
      : storedEmails;

    const mergedPhones = options.copyContact !== false
      ? mergeUnique(storedPhones, legacyPhoneHashes)
      : storedPhones;

    const mergedLocations = options.copyLocation !== false
      ? mergeUnique(storedLocations, legacy.locations)
      : storedLocations;

    const metadata = {
      ...parseMetadata(target.metadata),
      legacyMerge: {
        source: legacy.username,
        mergedAt: new Date().toISOString(),
        disposition: options.legacyDisposition || 'preserve',
        keepLegacyLoginActive: options.keepLegacyLoginActive !== false,
        note: options.note || null,
      },
    };

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        passwordHash: options.overwritePassword && legacy.password
          ? await hashPassword(legacy.password)
          : target.passwordHash,
        emails: serializeList(mergedEmails),
        phones: serializeList(mergedPhones),
        locations: serializeList(mergedLocations),
        name: options.copyProfileFields ? sanitizeString(legacy.name) || target.name : target.name,
        gender: options.copyProfileFields ? sanitizeString(legacy.gender) || target.gender : target.gender,
        dob: options.copyProfileFields && legacy.dob ? new Date(legacy.dob) : target.dob,
        pronouns: options.copyProfileFields ? sanitizeString(legacy.pronouns) || target.pronouns : target.pronouns,
        bio: options.copyProfileFields ? sanitizeString(legacy.bio) || target.bio : target.bio,
        website: options.copyProfileFields ? sanitizeString(legacy.website) || target.website : target.website,
        metadata: serializeMetadata(metadata),
      },
    });

    return NextResponse.json({
      operation: 'merge',
      user: {
        id: updated.id,
        username: updated.username,
        loginId: updated.loginId,
      },
      summary: {
        emails: mergedEmails.length,
        phones: mergedPhones.length,
        locations: mergedLocations.length,
        legacyDisposition: metadata.legacyMerge,
      },
    });
  } catch (error) {
    console.error('Legacy merge failed', error);
    return NextResponse.json({ error: 'Legacy merge failed.' }, { status: 500 });
  }
}
