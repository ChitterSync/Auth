import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { getSessionFromRefreshToken } from "../../../../lib/auth/session";
import { REFRESH_COOKIE_NAME } from "../../../../lib/auth/cookies";

type SetupPayload = {
  profile?: {
    name?: string;
    bio?: string;
    pronouns?: string;
    location?: string;
    website?: string;
  };
  interests?: string[];
  dataCollection?: {
    analytics?: boolean;
    personalized?: boolean;
    marketing?: boolean;
  };
};

const sanitizeString = (value: unknown, maxLen: number) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
};

const sanitizeList = (value: unknown, maxItems: number, maxLen: number) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => Boolean(entry))
    .map((entry) => entry.slice(0, maxLen))
    .slice(0, maxItems);
};

const serializeList = (values: string[]) => (values.length ? JSON.stringify(values) : null);

const parsePreferences = (value?: string | null) => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const parseLocations = (value?: string | null) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getSession = async (req: NextRequest) => {
  const refreshToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value ?? null;
  if (!refreshToken) return null;
  return getSessionFromRefreshToken(prisma, refreshToken);
};

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { settings: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preferences = parsePreferences(user.settings?.preferences ?? null);
  const locations = parseLocations(user.locations ?? null);

  return NextResponse.json(
    {
      profile: {
        name: user.name ?? "",
        bio: user.bio ?? "",
        pronouns: user.pronouns ?? "",
        location: locations[0] || "",
        website: user.website ?? "",
      },
      interests: Array.isArray((preferences as any).interests) ? (preferences as any).interests : [],
      dataCollection: {
        analytics: Boolean((preferences as any).dataCollection?.analytics),
        personalized: Boolean((preferences as any).dataCollection?.personalized),
        marketing: Boolean((preferences as any).dataCollection?.marketing),
      },
    },
    { status: 200 },
  );
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as SetupPayload;
  const name = sanitizeString(body.profile?.name, 80);
  const bio = sanitizeString(body.profile?.bio, 200);
  const pronouns = sanitizeString(body.profile?.pronouns, 32);
  const location = sanitizeString(body.profile?.location, 80);
  const website = sanitizeString(body.profile?.website, 200);
  const interests = sanitizeList(body.interests, 10, 24);
  const dataCollection = {
    analytics: Boolean(body.dataCollection?.analytics),
    personalized: Boolean(body.dataCollection?.personalized),
    marketing: Boolean(body.dataCollection?.marketing),
  };

  const userUpdate: Record<string, string | null> = {};
  if (name !== null) userUpdate.name = name;
  if (bio !== null) userUpdate.bio = bio;
  if (pronouns !== null) userUpdate.pronouns = pronouns;
  if (website !== null) userUpdate.website = website;
  if (location !== null) userUpdate.locations = serializeList([location]);

  if (Object.keys(userUpdate).length) {
    await prisma.user.update({
      where: { id: session.userId },
      data: userUpdate,
    });
  }

  const existing = await prisma.userSetting.findUnique({
    where: { userId: session.userId },
  });
  const preferences = parsePreferences(existing?.preferences ?? null);
  const merged = {
    ...preferences,
    interests,
    dataCollection,
    onboarding: {
      ...(preferences as any).onboarding,
      completed: true,
      completedAt: new Date().toISOString(),
    },
  };

  await prisma.userSetting.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, preferences: JSON.stringify(merged) },
    update: { preferences: JSON.stringify(merged) },
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
