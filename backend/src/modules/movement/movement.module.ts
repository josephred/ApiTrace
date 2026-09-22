import { Module } from '@nestjs/common';
import { MovementController, MovementRuleController } from './movement.controller';
import { MovementService } from './movement.service';
import { MovementRuleService } from './movement-rule.service';
import { DteController } from './dte.controller';
import { DteService } from './dte.service';
import { DteQueryService } from './dte-query.service';
import { DteChecksService } from './dte-checks.service';
import { DteQueries } from './dte.queries';
import { DteLifecycleService } from './dte-lifecycle.service';
import { DteSyncWorker } from './dte-sync.worker';
import { senasaGatewayProvider } from './senasa/senasa.provider';
import { EstablishmentModule } from '../establishment/establishment.module';

@Module({
  imports: [EstablishmentModule],
  controllers: [MovementController, MovementRuleController, DteController],
  providers: [
    MovementService,
    MovementRuleService,
    DteQueries,
    DteLifecycleService,
    DteChecksService,
    DteQueryService,
    DteService,
    DteSyncWorker,
    senasaGatewayProvider,
  ],
  exports: [
    MovementService,
    MovementRuleService,
    DteService,
    DteQueryService,
    DteQueries,
    DteLifecycleService,
  ],
})
export class MovementModule {}
