import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '../../../../lib/prisma';

type ProfilePayload = {
  username?: unknown;
  profile?: {
    displayName?: unknown;
    bio?: unknown;
    pronouns?: unknown;
    website?: unknown;
    location?: unknown;
  };
};

function unauthorized(status = 401) {
  return NextResponse.json({ error: 'Unauthorized' }, { status });
}

function ensureServiceKey(req: NextRequest) {
  const required = process.env.SERVICE_API_KEY;
  if (!required) {
    throw new Error('SERVICE_API_KEY is not configured');
  }
  const header = req.headers.get('authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return unauthorized();
  }
  const provided = header.slice(7).trim();
  if (provided !== required) {
    return unauthorized();
  }
  return null;
}

const sanitizeString = (value: unknown, max = 200): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

const serializeList = (values: string[]) => (values.length ? JSON.stringify(values) : null);

const parseList = (value?: string | null): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : [];
  } catch {
    return [];
  }
};

export async function GET(req: NextRequest) {
  try {
    const prisma = await getPrisma();
    const authError = ensureServiceKey(req);
    if (authError) return authError;

    const username = req.nextUrl.searchParams.get('username');
    if (!username) {
      return NextResponse.json({ error: 'Missing username' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const locations = parseList(user.locations ?? null);
    return NextResponse.json({
      username: user.username,
      displayName: user.name ?? user.username,
      bio: user.bio ?? '',
      pronouns: user.pronouns ?? '',
      website: user.website ?? '',
      location: locations[0] || '',
    });
  } catch (error) {
    console.error('service profile GET failed', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const prisma = await getPrisma();
    const authError = ensureServiceKey(req);
    if (authError) return authError;

    const body = (await req.json().catch(() => ({}))) as ProfilePayload;
    const username = body.username;
    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Missing username' }, { status: 400 });
    }

    const profile = body.profile ?? {};
    const name = sanitizeString(profile.displayName, 80);
    const bio = sanitizeString(profile.bio, 200);
    const pronouns = sanitizeString(profile.pronouns, 32);
    const website = sanitizeString(profile.website, 200);
    const location = sanitizeString(profile.location, 80);

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const update: Record<string, unknown> = {};
    if (name !== null) update.name = name;
    if (bio !== null) update.bio = bio;
    if (pronouns !== null) update.pronouns = pronouns;
    if (website !== null) update.website = website;
    if (location !== null) update.locations = serializeList([location]);

    if (Object.keys(update).length) {
      await prisma.user.update({ where: { username }, data: update });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('service profile POST failed', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
