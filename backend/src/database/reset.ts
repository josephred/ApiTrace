/**
 * Vacia todas las tablas de dominio conservando el esquema y el historial de
 * migraciones. Solo para desarrollo: se niega a correr contra produccion.
 */
import 'dotenv/config';
import { Pool } from 'pg';

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
  'dte_status_history',
  'dte',
  'movement',
  'vehicle',
  'carrier',
  'hive',
  'apiary',
  'renspa_registration',
  'establishment',
  'renapa_registration',
  'senasa_delegation',
  'producer',
  'refresh_token',
  'app_user',
  'organization',
  'movement_rule',
  'code_sequence',
];

/** TLS obligatorio en proveedores gestionados o si la URL lo pide. */
const needsTls = (url: string): boolean =>
  /\bneon\.tech\b/.test(url) ||
  /\brender\.com\b/.test(url) ||
  /[?&]sslmode=(require|verify-ca|verify-full)\b/.test(url);

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_RESET !== 'true') {
    throw new Error('db:reset esta bloqueado en produccion. Use ALLOW_RESET=true si esta seguro.');
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL es obligatoria.');

  const pool = new Pool({
    connectionString: url,
    ssl: needsTls(url) ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 30_000,
  });
  try {
    await pool.query(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
    console.log(`[reset] ${TABLES.length} tablas vaciadas.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('[reset] Error:', error);
  process.exit(1);
});
