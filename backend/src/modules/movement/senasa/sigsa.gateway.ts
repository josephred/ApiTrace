import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainRuleException } from '../../../common/exceptions/domain-rule.exception';
import { IntegrationLogService } from '../../../common/services/integration-log.service';
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
export class SigsaSenasaGateway implements SenasaGateway {
  private readonly logger = new Logger(SigsaSenasaGateway.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly config: ConfigService,
    private readonly integrationLog: IntegrationLogService,
  ) {
    const senasaConfig = this.config.get('senasa');
    this.apiUrl = senasaConfig?.apiUrl ?? 'https://api-sem.senasa.gob.ar/v1';
    this.apiKey = senasaConfig?.apiKey ?? '';
    this.timeoutMs = senasaConfig?.timeoutMs ?? 15000;
  }

  async requestDte(input: RequestDteInput): Promise<RequestDteResult> {
    const start = Date.now();
    const endpoint = `${this.apiUrl}/dte/solicitar`;

    const payload = {
      movimiento_id: input.movementId,
      origen: {
        renspa: input.originRenspa,
        codigo: input.originCode,
      },
      destino: {
        renspa: input.destinationRenspa,
        codigo: input.destinationCode,
      },
      titular_cuit: input.holderTaxId,
      fecha_carga: input.loadDate,
      fecha_vencimiento: input.expiryDate,
      cantidad_declarada: input.declaredQuantity,
      unidad: input.unit,
      producto_codigo: input.productCode,
      producto_nombre: input.productName,
      transporte: {
        tipo: input.transportType,
        patente: input.transportPlate,
        patente_acoplado: input.transportTrailerPlate,
      },
      motivo_transito: input.transitReason,
    };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'X-Correlation-ID': input.correlationId ?? '',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      const resBody = await response.json().catch(() => ({}));

      if (!response.ok) {
        await this.integrationLog.record({
          system: 'SENASA_SIGSA',
          operation: 'requestDte',
          requestId: input.movementId,
          requestPayload: payload,
          responsePayload: resBody,
          status: 'ERROR',
          httpStatus: response.status,
          latencyMs,
          errorCode: resBody.codigo_error ?? `HTTP_${response.status}`,
          errorMessage: resBody.mensaje ?? 'Error al solicitar DT-e en SENASA SIGSA',
          correlationId: input.correlationId,
        });

        throw new DomainRuleException(
          HttpStatus.BAD_GATEWAY,
          resBody.codigo_error ?? 'SENASA_RECHAZO_SOLICITUD',
          resBody.mensaje ?? 'SENASA SIGSA no autorizo la emision del DT-e.',
          resBody.detalles,
        );
      }

      await this.integrationLog.record({
        system: 'SENASA_SIGSA',
        operation: 'requestDte',
        requestId: input.movementId,
        externalId: resBody.id_sigsa ?? resBody.numero_dte,
        requestPayload: payload,
        responsePayload: resBody,
        status: 'SUCCESS',
        httpStatus: response.status,
        latencyMs,
        correlationId: input.correlationId,
      });

      return {
        externalId: String(resBody.id_sigsa ?? resBody.numero_dte),
        number: resBody.numero_dte,
        verificationCode: resBody.codigo_verificacion,
        pdfUrl: resBody.pdf_url ?? null,
        status: resBody.estado ?? 'EMITIDO',
        feePaid: Boolean(resBody.arancel_pagado),
        issuedAt: resBody.fecha_emision ? new Date(resBody.fecha_emision) : new Date(),
      };
    } catch (err: unknown) {
      if (err instanceof DomainRuleException) throw err;
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error conectando con SIGSA: ${errorMsg}`);
      await this.integrationLog.record({
        system: 'SENASA_SIGSA',
        operation: 'requestDte',
        requestId: input.movementId,
        requestPayload: payload,
        status: 'ERROR',
        latencyMs: Date.now() - start,
        errorMessage: errorMsg,
        correlationId: input.correlationId,
      });
      throw new DomainRuleException(
        HttpStatus.BAD_GATEWAY,
        'SENASA_UNAVAILABLE',
        `No fue posible comunicarse con el servicio SIGSA de SENASA: ${errorMsg}`,
      );
    }
  }

  async voidDte(input: VoidDteInput): Promise<VoidDteResult> {
    const start = Date.now();
    const endpoint = `${this.apiUrl}/dte/${encodeURIComponent(input.dteNumber)}/anular`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ motivo: input.reason }),
      });

      const latencyMs = Date.now() - start;
      const resBody = await response.json().catch(() => ({}));

      await this.integrationLog.record({
        system: 'SENASA_SIGSA',
        operation: 'voidDte',
        requestId: input.dteNumber,
        requestPayload: { motivo: input.reason },
        responsePayload: resBody,
        status: response.ok ? 'SUCCESS' : 'ERROR',
        httpStatus: response.status,
        latencyMs,
        correlationId: input.correlationId,
      });

      return {
        success: response.ok,
        voidedAt: new Date(),
        message: resBody.mensaje ?? 'Anulado en SIGSA',
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new DomainRuleException(HttpStatus.BAD_GATEWAY, 'SENASA_UNAVAILABLE', errorMsg);
    }
  }

  async closeDte(input: CloseDteInput): Promise<CloseDteResult> {
    const start = Date.now();
    const endpoint = `${this.apiUrl}/dte/${encodeURIComponent(input.dteNumber)}/cerrar`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          codigo_verificacion: input.verificationCode,
          cantidad_confirmada: input.confirmedQuantity,
          fecha_arribo: (input.arrivalAt ?? new Date()).toISOString(),
          codigo_senasa_sala: input.destinationSenasaCode,
        }),
      });

      const latencyMs = Date.now() - start;
      const resBody = await response.json().catch(() => ({}));

      await this.integrationLog.record({
        system: 'SENASA_SIGSA',
        operation: 'closeDte',
        requestId: input.dteNumber,
        responsePayload: resBody,
        status: response.ok ? 'SUCCESS' : 'ERROR',
        httpStatus: response.status,
        latencyMs,
        correlationId: input.correlationId,
      });

      return {
        success: response.ok,
        closedAt: new Date(),
        message: resBody.mensaje ?? 'Cerrado en SIGSA / SITA',
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new DomainRuleException(HttpStatus.BAD_GATEWAY, 'SENASA_UNAVAILABLE', errorMsg);
    }
  }

  async reportNoArrival(input: NoArrivalInput): Promise<NoArrivalResult> {
    const endpoint = `${this.apiUrl}/dte/${encodeURIComponent(input.dteNumber)}/sin-arribo`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ motivo: input.reason }),
      });

      const resBody = await response.json().catch(() => ({}));
      return {
        success: response.ok,
        reportedAt: new Date(),
        message: resBody.mensaje ?? 'Sin arribo asentado en SIGSA',
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new DomainRuleException(HttpStatus.BAD_GATEWAY, 'SENASA_UNAVAILABLE', errorMsg);
    }
  }
}
