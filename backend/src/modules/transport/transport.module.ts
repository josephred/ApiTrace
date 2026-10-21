import { Global, Module } from '@nestjs/common';
import { VehicleController } from './vehicle.controller';
import { VehicleService } from './vehicle.service';

/** Global: el asistente del DT-e completa el transporte desde el vehiculo guardado. */
@Global()
@Module({
  controllers: [VehicleController],
  providers: [VehicleService],
  exports: [VehicleService],
})
export class TransportModule {}
