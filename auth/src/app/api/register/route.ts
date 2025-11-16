import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Cloudflare R2 integration
export const runtime = 'edge';

// Define a type for the R2 interface
interface R2Bucket {
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ objects: { key: string }[] }>;

}

function getR2(): R2Bucket {
  // Use the correct R2 binding name for production
  const envUnknown = globalThis as unknown as { env?: { r7105_cs?: R2Bucket } };
  if (envUnknown.env && envUnknown.env.r7105_cs) {
    return envUnknown.env.r7105_cs;
  }
  // Fallback: in-memory mock for local dev (object storage semantics)
  const globalWithMock = globalThis as unknown as { _mockR2Store?: Record<string, string> };
  if (!globalWithMock._mockR2Store) {
    globalWithMock._mockR2Store = {};
  }
  const store = globalWithMock._mockR2Store;
  return {
    async get(key: string) {
      if (store[key] !== undefined) {
        return {
          async text() { return store[key]; }
        };
      }
      return null;
    },
    async put(key: string, value: string) { store[key] = value; },
    async delete(key: string) { delete store[key]; },
    async list(options?: { prefix?: string }) {
      const prefix = options?.prefix || '';
      return {
        objects: Object.keys(store)
          .filter(key => key.startsWith(prefix))
          .map(key => ({ key }))
      };
    },
  };
}

// Cookie helper (set cookie in Next.js Edge API)
export function setCookie(res: NextResponse, name: string, value: string, options: { path?: string; maxAge?: number } = {}) {
  let cookie = `${name}=${encodeURIComponent(value)}`;
  if (options.path) cookie += `; Path=${options.path}`;
  if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
  res.headers.append('Set-Cookie', cookie);
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const r2 = getR2();

    // Validate required fields
    if (
      !data.loginId ||
      !data.password ||
      (!data.email?.length && !data.phone?.length) ||
      !data.username
    ) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // Check for duplicate loginId or username
    const loginIdKey = `loginId:${data.loginId}`;
    const usernameKey = `username:${data.username}`;
    const existingLoginIdObj = await r2.get(loginIdKey);
    const existingUsernameObj = await r2.get(usernameKey);
    const existingLoginId = existingLoginIdObj ? await existingLoginIdObj.text() : null;
    const existingUsername = existingUsernameObj ? await existingUsernameObj.text() : null;
    if (existingLoginId) {
      return NextResponse.json({ error: 'Login ID already exists.' }, { status: 409 });
    }
    if (existingUsername) {
      return NextResponse.json({ error: 'Username already exists.' }, { status: 409 });
    }

    // Assign UUID and create user object
    const userId = uuidv4();
    const user = {
      userId,
      loginId: data.loginId,
      password: data.password, // assumed encrypted client-side
      email: data.email,
      phone: data.phone,
      username: data.username,
      name: data.name,
      gender: data.gender,
      dob: data.dob,
      location: data.location,
      createdAt: new Date().toISOString(),
    };

    // Store user in R2 (by userId, loginId, and username for fast lookup)
    await r2.put(`user:${userId}`, JSON.stringify(user));
    await r2.put(loginIdKey, userId);
    await r2.put(usernameKey, userId);

    return NextResponse.json({ userId }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
}
