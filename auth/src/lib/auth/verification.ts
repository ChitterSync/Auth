import type { PrismaClient } from '@prisma/client';
import { createToken, hashToken } from './tokens';

type VerificationTokenType = 'verify_email' | 'password_reset';

export const createVerificationToken = async (
  prisma: PrismaClient,
  params: {
    userId?: string | null;
    identifier: string;
    type: VerificationTokenType;
    ttlMs: number;
  },
) => {
  const token = createToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + params.ttlMs);

  await prisma.verificationToken.deleteMany({
    where: { identifier: params.identifier, type: params.type },
  });

  const record = await prisma.verificationToken.create({
    data: {
      id: createToken(16),
      userId: params.userId ?? null,
      identifier: params.identifier,
      tokenHash,
      type: params.type,
      expiresAt,
    },
  });

  return { token, record };
};

export const consumeVerificationToken = async (
  prisma: PrismaClient,
  params: {
    identifier: string;
    token: string;
    type: VerificationTokenType;
  },
) => {
  const tokenHash = hashToken(params.token);
  const now = new Date();
  const record = await prisma.verificationToken.findFirst({
    where: {
      identifier: params.identifier,
      tokenHash,
      type: params.type,
      consumedAt: null,
      expiresAt: { gt: now },
    },
  });

  if (!record) return null;

  await prisma.verificationToken.update({
    where: { id: record.id },
    data: { consumedAt: now },
  });

  return record;
};
