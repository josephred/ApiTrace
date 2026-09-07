/** Aplica migraciones y deja la base de test vacia antes de correr la suite. */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { join } from 'node:path';

const TABLES = [
  'idempotency_key',
  'integration_event',
  'outbox_event',
  'audit_event',
  'traceability_event',
  'document',
  'sample',
  'inventory_event',
  'movement_item',
  'drum',
  'lot_input',
  'lot',
  'extraction_input',
  'extraction',
  'reception',
  'dte',
  'movement',
  'vehicle',
  'carrier',
  'hive',
  'apiary',
  'renspa_registration',
  'establishment',
  'renapa_registration',
  'producer',
  'refresh_token',
  'app_user',
  'organization',
  'movement_rule',
  'code_sequence',
];

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
