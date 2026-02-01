import 'dotenv/config';
import { defineConfig } from '@prisma/config';

const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl =
  process.env.DATABASE_URL ?? (isProduction ? '' : 'postgresql://localhost:5432/chittersync_auth');

if (isProduction && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be defined in production.');
}

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
  migrations: {
    path: './prisma/migrations',
  },
});
