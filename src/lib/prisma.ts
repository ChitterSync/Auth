import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import path from 'node:path';

type D1DatabaseLike = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      run: () => Promise<unknown>;
      all: () => Promise<unknown>;
      raw: () => Promise<unknown>;
    };
  };
  batch: (statements: unknown[]) => Promise<unknown[]>;
  exec: (query: string) => Promise<unknown>;
};

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const getD1Database = async (): Promise<D1DatabaseLike | null> => {
  try {
    const mod = await import('@cloudflare/next-on-pages');
    const ctx = mod.getRequestContext?.();
    const env = ctx?.env as Record<string, unknown> | undefined;
    return (env?.DB as D1DatabaseLike | undefined) ?? null;
  } catch {
    return null;
  }
};

const getLocalPrisma = () => {
  if (global.prisma) return global.prisma;
  const configuredUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';
  const url =
    configuredUrl.startsWith('file:./') || configuredUrl.startsWith('file:../')
      ? `file:${path.resolve(process.cwd(), configuredUrl.slice('file:'.length))}`
      : configuredUrl;
  const adapter = new PrismaLibSql({ url });
  const prisma = new PrismaClient({ adapter });
  if (process.env.NODE_ENV !== 'production') global.prisma = prisma;
  return prisma;
};

export const getPrisma = async () => {
  const d1 = await getD1Database();
  if (d1) {
    return new PrismaClient({ adapter: new PrismaD1(d1 as any) });
  }
  return getLocalPrisma();
};

export default getPrisma;
