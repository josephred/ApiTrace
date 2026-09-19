import { Injectable, Logger } from '@nestjs/common';
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
export class SimulatedSenasaGateway implements SenasaGateway {
  private readonly logger = new Logger(SimulatedSenasaGateway.name);

  async requestDte(input: RequestDteInput): Promise<RequestDteResult> {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const verifSuffix = Math.floor(1000 + Math.random() * 9000);
    const number = `DTE-2026-${randomSuffix}`;
    const verificationCode = `VER-${verifSuffix}`;
    const externalId = `SIGSA-SIM-${Date.now()}-${randomSuffix}`;
    const issuedAt = new Date();

    this.logger.log(
      `[SIMULADOR] DT-e emitido exitosamente: ${number} (verificacion: ${verificationCode}) para movimiento ${input.movementId}`,
    );

    return {
      externalId,
      number,
      verificationCode,
      pdfUrl: `https://apitrace.ar/static/dte/simulado/${number}.pdf`,
      status: 'EMITIDO',
      feePaid: true,
      issuedAt,
    };
  }

  async voidDte(input: VoidDteInput): Promise<VoidDteResult> {
    this.logger.log(`[SIMULADOR] DT-e ${input.dteNumber} anulado ante SENASA. Motivo: ${input.reason}`);
    return {
      success: true,
      voidedAt: new Date(),
      message: `DT-e ${input.dteNumber} anulado con exito en simulador SIGSA.`,
    };
  }

  async closeDte(input: CloseDteInput): Promise<CloseDteResult> {
    this.logger.log(
      `[SIMULADOR] DT-e ${input.dteNumber} cerrado en sala con codigo ${input.verificationCode} y cantidad ${input.confirmedQuantity}`,
    );
    return {
      success: true,
      closedAt: input.arrivalAt ?? new Date(),
      message: `DT-e ${input.dteNumber} cerrado correctamente en SITA (simulador).`,
    };
  }

  async reportNoArrival(input: NoArrivalInput): Promise<NoArrivalResult> {
    this.logger.log(`[SIMULADOR] Declarado sin arribo DT-e ${input.dteNumber}. Motivo: ${input.reason}`);
    return {
      success: true,
      reportedAt: new Date(),
      message: `Reporte de sin arribo asentado para DT-e ${input.dteNumber} (simulador).`,
    };
  }
}
