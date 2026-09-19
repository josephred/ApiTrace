import { Module } from '@nestjs/common';
import { MovementController, MovementRuleController } from './movement.controller';
import { MovementService } from './movement.service';
import { MovementRuleService } from './movement-rule.service';
import { DteService } from './dte.service';
import { DteController } from './dte.controller';
import { DteLifecycleService } from './dte-lifecycle.service';
import { DteSyncWorker } from './dte-sync.worker';
import { SenasaGatewayProvider } from './senasa/senasa.provider';
import { EstablishmentModule } from '../establishment/establishment.module';

@Module({
  imports: [EstablishmentModule],
  controllers: [MovementController, MovementRuleController, DteController],
  providers: [
    MovementService,
    MovementRuleService,
    DteService,
    DteLifecycleService,
    DteSyncWorker,
    SenasaGatewayProvider,
  ],
  exports: [MovementService, MovementRuleService, DteService, SenasaGatewayProvider],
})
export class MovementModule {}
