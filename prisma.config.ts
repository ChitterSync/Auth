import 'dotenv/config';
import { defineConfig } from '@prisma/config';

const rawDatabaseUrl = process.env.DATABASE_URL?.trim();
const databaseUrl =
  rawDatabaseUrl && rawDatabaseUrl.startsWith('file:')
    ? rawDatabaseUrl
    : 'file:./prisma/dev.db';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
  migrations: {
    path: './prisma/migrations',
  },
});
