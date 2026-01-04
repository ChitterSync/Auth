import type { PrismaClient, Session } from '@prisma/client';
import { v6 as uuidv6 } from 'uuid';
import { createToken, hashToken, safeEqual } from './tokens';

export type SessionMetadata = {
  userAgent?: string | null;
  ip?: string | null;
};

type ParsedRefreshToken = {
  sessionId: string;
  tokenPart: string;
};

export const buildRefreshToken = (sessionId: string) => {
  const tokenPart = createToken();
  return {
    refreshToken: `${sessionId}.${tokenPart}`,
    refreshHash: hashToken(tokenPart),
  };
};

export const parseRefreshToken = (rawToken?: string | null): ParsedRefreshToken | null => {
  if (!rawToken) return null;
  const [sessionId, tokenPart] = rawToken.split('.');
  if (!sessionId || !tokenPart) return null;
  return { sessionId, tokenPart };
};

export const isRefreshTokenMatch = (session: Session, tokenPart: string) =>
  safeEqual(session.refreshHash, hashToken(tokenPart));

export const createSession = async (
  prisma: PrismaClient,
  userId: string,
  metadata: SessionMetadata,
) => {
  const sessionId = uuidv6();
  const { refreshToken, refreshHash } = buildRefreshToken(sessionId);
  const session = await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      refreshHash,
      userAgent: metadata.userAgent ?? null,
      ip: metadata.ip ?? null,
      lastSeenAt: new Date(),
    },
  });

  return { session, refreshToken };
};

export const rotateRefreshToken = async (
  prisma: PrismaClient,
  rawToken: string | null | undefined,
  metadata: SessionMetadata,
) => {
  const parsed = parseRefreshToken(rawToken);
  if (!parsed) {
    return { status: 'invalid' as const };
  }

  const session = await prisma.session.findUnique({ where: { id: parsed.sessionId } });
  if (!session) {
    return { status: 'invalid' as const };
  }

  if (session.revokedAt) {
    return { status: 'revoked' as const, session };
  }

  if (!isRefreshTokenMatch(session, parsed.tokenPart)) {
    const revoked = await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return { status: 'reused' as const, session: revoked };
  }

  const { refreshToken, refreshHash } = buildRefreshToken(session.id);
  const updated = await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshHash,
      lastSeenAt: new Date(),
      userAgent: metadata.userAgent ?? session.userAgent,
      ip: metadata.ip ?? session.ip,
    },
  });

  return { status: 'rotated' as const, session: updated, refreshToken };
};

export const getSessionFromRefreshToken = async (
  prisma: PrismaClient,
  rawToken: string | null | undefined,
) => {
  const parsed = parseRefreshToken(rawToken);
  if (!parsed) return null;
  const session = await prisma.session.findUnique({ where: { id: parsed.sessionId } });
  if (!session || session.revokedAt) return null;
  if (!isRefreshTokenMatch(session, parsed.tokenPart)) return null;
  return session;
};
