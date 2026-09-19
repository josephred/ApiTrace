import { Injectable, HttpStatus } from '@nestjs/common';
import { DomainRuleException } from '../../../common/exceptions/domain-rule.exception';
import type {
  CloseDteInput,
  CloseDteResult,
  NoArrivalInput,
  NoArrivalResult,
  RequestDteInput,
  RequestDteResult,
  SenasaGateway,
  VoidDteInput,
  VoidDteResult,
} from './senasa.gateway';

@Injectable()
export class ManualSenasaGateway implements SenasaGateway {
  async requestDte(_input: RequestDteInput): Promise<RequestDteResult> {
    throw new DomainRuleException(
      HttpStatus.BAD_REQUEST,
      'MODO_MANUAL_REQUIERE_CARGA',
      'El sistema esta configurado en modo manual. Debe emitir el DT-e directamente en SIGSA y cargar el numero y codigo de verificacion mediante el formulario.',
    );
  }

  async voidDte(input: VoidDteInput): Promise<VoidDteResult> {
    return {
      success: true,
      voidedAt: new Date(),
      message: `Anulacion registrada en modo manual para DT-e ${input.dteNumber}. Recuerde anular tambien en autogestion SIGSA.`,
    };
  }

  async closeDte(input: CloseDteInput): Promise<CloseDteResult> {
    return {
      success: true,
      closedAt: input.arrivalAt ?? new Date(),
      message: `Cierre registrado en modo manual para DT-e ${input.dteNumber}.`,
    };
  }

  async reportNoArrival(input: NoArrivalInput): Promise<NoArrivalResult> {
    return {
      success: true,
      reportedAt: new Date(),
      message: `Sin arribo registrado en modo manual para DT-e ${input.dteNumber}.`,
    };
  }
}
