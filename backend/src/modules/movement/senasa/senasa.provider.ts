import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationLogService } from '../../../common/services/integration-log.service';
import { ManualSenasaGateway } from './manual.gateway';
import { SENASA_GATEWAY } from './senasa.gateway';
import { SigsaSenasaGateway } from './sigsa.gateway';
import { SimulatedSenasaGateway } from './simulated.gateway';

export const SenasaGatewayProvider: Provider = {
  provide: SENASA_GATEWAY,
  useFactory: (config: ConfigService, integrationLog: IntegrationLogService) => {
    const mode = (config.get('senasa')?.mode ?? 'SIMULADO').toUpperCase();
    if (mode === 'SIGSA') {
      return new SigsaSenasaGateway(config, integrationLog);
    }
    if (mode === 'MANUAL') {
      return new ManualSenasaGateway();
    }
    return new SimulatedSenasaGateway();
  },
  inject: [ConfigService, IntegrationLogService],
};
