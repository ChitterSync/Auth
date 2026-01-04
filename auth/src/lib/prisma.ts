import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL ?? (isProduction ? '' : 'file:./prisma/dev.db');

if (isProduction && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be defined in production.');
}

const adapter = new PrismaLibSql({
  url: databaseUrl,
});

const prisma = global.prisma || new PrismaClient({ adapter });
if (process.env.NODE_ENV !== 'production') global.prisma = prisma;

export default prisma;
