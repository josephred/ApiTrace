import { Global, Module } from '@nestjs/common';
import { ZoneController } from './zone.controller';
import { ZoneService } from './zone.service';

/** Global: el alta de apiarios resuelve la zona (o la crea) con este servicio. */
@Global()
@Module({
  controllers: [ZoneController],
  providers: [ZoneService],
  exports: [ZoneService],
})
export class ZoneModule {}
