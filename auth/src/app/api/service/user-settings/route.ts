import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';

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

const parsePreferences = (value?: string | null) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const serializePreferences = (settings: Record<string, unknown>) => JSON.stringify(settings);

export async function GET(req: NextRequest) {
  try {
    const authError = ensureServiceKey(req);
    if (authError) return authError;

    const username = req.nextUrl.searchParams.get('username');
    if (!username) {
      return NextResponse.json({ error: 'Missing username' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { settings: true },
    });

    if (!user) {
      return NextResponse.json({ exists: false }, { status: 404 });
    }

    return NextResponse.json({
      exists: true,
      userId: user.id,
      settings: parsePreferences(user.settings?.preferences ?? null),
      updatedAt: user.settings?.updatedAt ?? null,
    });
  } catch (error) {
    console.error('user-settings GET failed', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authError = ensureServiceKey(req);
    if (authError) return authError;

    const { username, settings } = await req.json().catch(() => ({}));
    if (!username || typeof settings !== 'object' || settings === null) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const saved = await prisma.userSetting.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        preferences: serializePreferences(settings),
      },
      update: {
        preferences: serializePreferences(settings),
      },
    });

    return NextResponse.json({
      success: true,
      userId: user.id,
      settings: parsePreferences(saved.preferences),
      updatedAt: saved.updatedAt,
    });
  } catch (error) {
    console.error('user-settings POST failed', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
