import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');
export const PG_POOL = Symbol('PG_POOL');

export type Database = NodePgDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.getOrThrow<string>('database.url');
        const ssl = config.get<boolean>('database.ssl');
        const pool = new Pool({
          connectionString: url,
          max: config.get<number>('database.poolMax') ?? 10,
          ssl: ssl ? { rejectUnauthorized: false } : undefined,
          // Neon suspende el computo por inactividad y Render duerme el servicio:
          // conviene reciclar conexiones ociosas y dar margen al despertar.
          idleTimeoutMillis: config.get<number>('database.idleTimeoutMs') ?? 30_000,
          connectionTimeoutMillis: config.get<number>('database.connectionTimeoutMs') ?? 10_000,
          // Sin esto, una conexion cortada del lado del proveedor queda en el pool
          // y el siguiente request falla en lugar de reconectar.
          keepAlive: true,
        });

        const poolLogger = new Logger('PgPool');
        pool.on('error', (err) => {
          poolLogger.warn(
            `Conexión inactiva de PostgreSQL reiniciada por el proveedor: ${err.message}`,
          );
        });

        return pool;
      },
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool) => drizzle(pool, { schema }),
    },
  ],
  exports: [DRIZZLE, PG_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
    this.logger.log('Pool de PostgreSQL cerrado.');
  }
}
