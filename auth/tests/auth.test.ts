import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { v6 as uuidv6 } from 'uuid';
import { hashPassword, verifyPassword } from '../src/lib/auth/password';
import { createSession, rotateRefreshToken } from '../src/lib/auth/session';
import { NextRequest } from 'next/server';

const TEST_DB_URL = 'file:./prisma/test.db';

let prisma: PrismaClient;

const makeRequest = (url: string, body?: Record<string, unknown>, cookie?: string) => {
  const headers = new Headers();
  if (body) {
    headers.set('content-type', 'application/json');
  }
  if (cookie) {
    headers.set('cookie', cookie);
  }
  return new NextRequest(
    new Request(url, {
      method: body ? 'POST' : 'DELETE',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
};

const resetDb = async () => {
  await prisma.session.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.oauthAccount.deleteMany();
  await prisma.userSetting.deleteMany();
  await prisma.user.deleteMany();
};

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_DB_URL;

  const testDbPath = path.join(process.cwd(), 'prisma', 'test.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  execSync('npx prisma db push --skip-generate', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
  });

  const adapter = new PrismaLibSql({ url: TEST_DB_URL });
  prisma = new PrismaClient({ adapter });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('auth utilities', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('super-secret');
    expect(hash).not.toBe('super-secret');
    await expect(verifyPassword('super-secret', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
  });

  it('rotates refresh tokens and revokes on reuse', async () => {
    await resetDb();
    const user = await prisma.user.create({
      data: {
        id: uuidv6(),
        loginId: 'login-rotation',
        username: 'rotation',
        passwordHash: await hashPassword('pass-rotation'),
      },
    });

    const { refreshToken } = await createSession(prisma, user.id, {
      userAgent: 'vitest',
      ip: '127.0.0.1',
    });

    const rotated = await rotateRefreshToken(prisma, refreshToken, {
      userAgent: 'vitest',
      ip: '127.0.0.1',
    });

    expect(rotated.status).toBe('rotated');
    expect(rotated.refreshToken).not.toBe(refreshToken);

    const reused = await rotateRefreshToken(prisma, refreshToken, {
      userAgent: 'vitest',
      ip: '127.0.0.1',
    });

    expect(reused.status).toBe('reused');
    const updated = await prisma.session.findFirst({ where: { userId: user.id } });
    expect(updated?.revokedAt).not.toBeNull();
  });
});

describe('auth routes', () => {
  it('returns generic responses for verification requests', async () => {
    await resetDb();
    const email = 'user@example.com';
    await prisma.user.create({
      data: {
        id: uuidv6(),
        loginId: 'login-email',
        username: 'emailuser',
        passwordHash: await hashPassword('pass-email'),
        emails: JSON.stringify([email]),
      },
    });

    const { POST: verifyRequest } = await import('../src/app/api/auth/verify-email/request/route');
    const resExisting = await verifyRequest(makeRequest('http://localhost/auth/verify-email/request', { email }));
    const resMissing = await verifyRequest(
      makeRequest('http://localhost/auth/verify-email/request', { email: 'missing@example.com' }),
    );

    expect(resExisting.status).toBe(200);
    expect(resMissing.status).toBe(200);
    const existingPayload = await resExisting.json();
    const missingPayload = await resMissing.json();
    expect(existingPayload).toEqual(missingPayload);
  });

  it('returns generic responses for password reset requests', async () => {
    await resetDb();
    await prisma.user.create({
      data: {
        id: uuidv6(),
        loginId: 'login-reset',
        username: 'resetuser',
        passwordHash: await hashPassword('pass-reset'),
      },
    });

    const { POST: resetRequest } = await import('../src/app/api/auth/password-reset/request/route');
    const resExisting = await resetRequest(
      makeRequest('http://localhost/auth/password-reset/request', { identifier: 'login-reset' }),
    );
    const resMissing = await resetRequest(
      makeRequest('http://localhost/auth/password-reset/request', { identifier: 'nope' }),
    );

    expect(resExisting.status).toBe(200);
    expect(resMissing.status).toBe(200);
    const existingPayload = await resExisting.json();
    const missingPayload = await resMissing.json();
    expect(existingPayload).toEqual(missingPayload);
  });

  it('revokes a session by id', async () => {
    await resetDb();
    const user = await prisma.user.create({
      data: {
        id: uuidv6(),
        loginId: 'login-revoke',
        username: 'revokeuser',
        passwordHash: await hashPassword('pass-revoke'),
      },
    });

    const { refreshToken } = await createSession(prisma, user.id, {
      userAgent: 'vitest',
      ip: '127.0.0.1',
    });

    const extra = await createSession(prisma, user.id, {
      userAgent: 'vitest',
      ip: '127.0.0.1',
    });

    const { DELETE: deleteSession } = await import('../src/app/api/auth/sessions/[id]/route');
    const res = await deleteSession(
      makeRequest('http://localhost/auth/sessions/delete', undefined, `ch_auth_refresh=${refreshToken}`),
      { params: { id: extra.session.id } },
    );

    expect(res.status).toBe(200);
    const updated = await prisma.session.findUnique({ where: { id: extra.session.id } });
    expect(updated?.revokedAt).not.toBeNull();
  });
});
