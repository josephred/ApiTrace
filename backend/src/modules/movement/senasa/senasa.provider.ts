import { Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../config/configuration';
import { ManualSenasaGateway } from './manual.gateway';
import { SENASA_GATEWAY, type SenasaGateway } from './senasa.gateway';
import { SigsaSenasaGateway } from './sigsa.gateway';
import { SimulatedSenasaGateway } from './simulated.gateway';

/** Elige el adaptador segun SENASA_MODE. El dominio solo conoce SENASA_GATEWAY. */
export const senasaGatewayProvider: Provider = {
  provide: SENASA_GATEWAY,
  inject: [ConfigService],
  useFactory: (config: ConfigService): SenasaGateway => {
    const senasa = config.getOrThrow<AppConfig['senasa']>('senasa');
    const logger = new Logger('SenasaGateway');

    switch (senasa.mode) {
      case 'simulado':
        if (config.get<string>('nodeEnv') === 'production') {
          logger.warn(
            'SENASA_MODE=simulado en produccion: los DT-e emitidos no tienen validez oficial.',
          );
        }
        logger.log('Integracion SENASA en modo SIMULADO.');
        return new SimulatedSenasaGateway();
      case 'sigsa':
        logger.log(`Integracion SENASA en modo SIGSA (${senasa.environment}).`);
        return new SigsaSenasaGateway({
          environment: senasa.environment,
          baseUrl: senasa.sigsaBaseUrl,
          platformTaxId: senasa.platformTaxId,
          timeoutMs: senasa.timeoutMs,
        });
      default:
        logger.log('Integracion SENASA en modo MANUAL (sin API).');
        return new ManualSenasaGateway();
    }
  },
};
