import 'dotenv/config';
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/apitrace',
  },
  verbose: true,
  strict: true,
} satisfies Config;
