/** Aplica migraciones y deja la base de test vacia antes de correr la suite. */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { join } from 'node:path';
import { TABLES } from './tables';

export default async function globalSetup(): Promise<void> {
  const url =
    process.env.DATABASE_URL_TEST ??
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/apitrace_test';

  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: join(__dirname, '..', 'drizzle') });
    await pool.query(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
  } finally {
    await pool.end();
  }
}
