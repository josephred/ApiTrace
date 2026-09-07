import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { Public } from '../../common/decorators';
import { OutboxDispatcher } from '../../common/services/outbox-dispatcher.service';

@ApiTags('Operacion')
@Controller()
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly outbox: OutboxDispatcher,
  ) {}

  /** Health check de Render: liviano, sin tocar la base de datos. */
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe.' })
  health() {
    return {
      status: 'ok',
      service: 'apitrace-api',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness: verifica dependencias reales. */
  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe: valida PostgreSQL y el outbox.' })
  async ready() {
    const checks: Record<string, { status: string; detail?: string }> = {};
    let healthy = true;

    try {
      await this.db.execute(sql`SELECT 1`);
      checks.database = { status: 'ok' };
    } catch (error) {
      healthy = false;
      checks.database = {
        status: 'error',
        detail: error instanceof Error ? error.message : String(error),
      };
    }

    try {
      const pending = await this.outbox.pendingCount();
      checks.outbox = { status: 'ok', detail: `${pending} eventos pendientes` };
    } catch {
      checks.outbox = { status: 'degraded' };
    }

    return { status: healthy ? 'ok' : 'error', checks, timestamp: new Date().toISOString() };
  }
}
