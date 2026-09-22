import { HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { apiary, dte, producer, renapaRegistration, senasaDelegation } from '../../database/schema';
import { DomainRuleException } from '../../common/exceptions/domain-rule.exception';
import { EstablishmentService } from '../establishment/establishment.service';
import { MovementService } from './movement.service';
import type { DteRow } from './dte.queries';
import {
  DTE_RULES,
  RENAPA_APIARY_PATTERN,
  SALA_CODE_PATTERN,
  daysBetween,
  effectiveStatus,
  isArgentinePlate,
  isIsoDate,
  suggestDeclaredQuantity,
  validateAnticipation,
  validateValidity,
} from './dte.rules';
import { SENASA_GATEWAY, type SenasaGateway } from './senasa/senasa.gateway';
import type {
  ApiaryRow,
  DraftData,
  DteCheck,
  DteCheckStatus,
  DteContext,
  EstablishmentRow,
  MovementRow,
  ProducerRow,
  RenapaRow,
} from './dte.types';

/**
 * Contexto y verificaciones previas del DT-e (especificacion 4.2.2 y
 * checklist 9): quien es el titular, que codigos oficiales tienen el apiario y
 * la sala, si estan habilitados, si el titular esta bloqueado por caducidad y
 * si el canal de emision permite pedirlo por API.
 *
 * No escribe nada: la usan la solicitud (DteService), la verificacion previa
 * (DteQueryService) y el worker de sincronizacion.
 */
@Injectable()
export class DteChecksService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly establishments: EstablishmentService,
    private readonly movements: MovementService,
    @Inject(SENASA_GATEWAY) private readonly gateway: SenasaGateway,
  ) {}

  /** DT-e caducados sin regularizar del titular: SIGSA no le permite emitir. */
  async holderBlock(producerId: string, now: Date = new Date()) {
    const rows = await this.db
      .select()
      .from(dte)
      .where(
        and(
          eq(dte.holderProducerId, producerId),
          inArray(dte.status, ['VENCIDO', 'CADUCADO']),
          isNull(dte.regularizedAt),
        ),
      );
    return rows.filter((row) => effectiveStatus(row.status, row, now) === 'CADUCADO');
  }

  async contextForRow(row: DteRow): Promise<DteContext> {
    return this.contextForMovement(await this.movements.findRaw(row.movementId));
  }

  /**
   * Verificaciones previas (seccion 4.2.2 y checklist 9). Con `forSubmission`
   * lo que falta es un error; al preparar un borrador, una advertencia.
   */
  async buildChecks(
    ctx: DteContext,
    draft: DraftData,
    options: { forSubmission: boolean; now: Date },
  ): Promise<DteCheck[]> {
    const checks: DteCheck[] = [];
    const add = (code: string, label: string, status: DteCheckStatus, message: string) =>
      checks.push({ code, label, status, message });
    const missing: DteCheckStatus = options.forSubmission ? 'error' : 'warning';
    const registryStatus = (status: string): DteCheckStatus =>
      status === 'ACTIVE' ? 'ok' : status === 'PENDING_VERIFICATION' ? 'warning' : 'error';

    // --------------------------------------------------------------- origen
    if (!ctx.apiary) {
      add(
        'ORIGEN_APIARIO',
        'Apiario de origen',
        missing,
        'El traslado no indica de que apiario sale.',
      );
    } else {
      const label = ctx.apiary.name ? `${ctx.apiary.code} — ${ctx.apiary.name}` : ctx.apiary.code;
      add(
        'ORIGEN_APIARIO',
        'Apiario de origen',
        ctx.apiary.status === 'ACTIVE' ? 'ok' : 'error',
        ctx.apiary.status === 'ACTIVE' ? label : `El apiario ${label} esta ${ctx.apiary.status}.`,
      );
      const code = ctx.apiary.renapaCode;
      if (!code) {
        add(
          'ORIGEN_RENAPA',
          'RENAPA del apiario',
          missing,
          'Falta el codigo RENAPA del apiario (ej. B53999-2). Cargalo en Apiarios.',
        );
      } else {
        const status = registryStatus(ctx.apiary.renapaStatus);
        add(
          'ORIGEN_RENAPA',
          'RENAPA del apiario',
          status,
          status === 'ok'
            ? `${code} habilitado.`
            : status === 'warning'
              ? `${code} cargado a mano, sin verificar contra SENASA.`
              : `${code} no esta habilitado (${ctx.apiary.renapaStatus}): SIGSA rechaza la emision.`,
        );
        if (!RENAPA_APIARY_PATTERN.test(code)) {
          add(
            'ORIGEN_RENAPA_FORMATO',
            'Formato del RENAPA',
            'warning',
            `${code} no sigue el formato Letra+N°RENAPA-N°Apiario (ej. B53999-2).`,
          );
        }
        if (ctx.apiary.renapaValidTo && ctx.apiary.renapaValidTo < draft.loadDate) {
          add(
            'ORIGEN_RENAPA_VIGENCIA',
            'Vigencia del apiario',
            'error',
            `La habilitacion del apiario vence el ${ctx.apiary.renapaValidTo}, antes de la fecha de carga.`,
          );
        }
      }
    }

    // -------------------------------------------------------------- titular
    if (!ctx.holder) {
      add(
        'TITULAR',
        'Titular',
        missing,
        'El predio del apiario no tiene productor titular asignado.',
      );
    } else {
      add(
        'TITULAR',
        'Titular',
        ctx.holder.taxId ? 'ok' : missing,
        ctx.holder.taxId
          ? `${ctx.holder.businessName} · CUIT ${ctx.holder.taxId}`
          : `${ctx.holder.businessName} no tiene CUIT cargado: el DT-e se emite a nombre de una CUIT.`,
      );
      if (!ctx.holderRenapa) {
        add(
          'TITULAR_RENAPA',
          'RENAPA del productor',
          missing,
          'El titular no tiene RENAPA registrado.',
        );
      } else {
        const status = registryStatus(ctx.holderRenapa.status);
        add(
          'TITULAR_RENAPA',
          'RENAPA del productor',
          status,
          status === 'ok'
            ? `RENAPA ${ctx.holderRenapa.number} activo.`
            : status === 'warning'
              ? `RENAPA ${ctx.holderRenapa.number} sin verificar contra SENASA.`
              : `RENAPA ${ctx.holderRenapa.number} ${ctx.holderRenapa.status}: SIGSA rechaza la emision.`,
        );
      }
      const blocked = await this.holderBlock(ctx.holder.id, options.now);
      if (blocked.length > 0) {
        add(
          'TITULAR_BLOQUEADO',
          'Bloqueo por caducidad',
          'error',
          `El titular tiene ${blocked.length} DT-e caducado(s) sin regularizar (${blocked
            .map((row) => row.number ?? row.id.slice(0, 8))
            .join(', ')}). SIGSA no le permite emitir nuevos.`,
        );
      }
    }

    // --------------------------------------------------------------- destino
    if (ctx.destination.type !== 'SALA_EXTRACCION') {
      add('DESTINO_SALA', 'Sala de destino', 'error', 'El destino no es una sala de extraccion.');
    } else {
      add(
        'DESTINO_SALA',
        'Sala de destino',
        ctx.destination.status === 'ACTIVE' ? 'ok' : 'error',
        ctx.destination.status === 'ACTIVE'
          ? ctx.destination.name
          : `La sala ${ctx.destination.name} esta ${ctx.destination.status}.`,
      );
    }
    const salaCode = ctx.destination.senasaCode;
    if (!salaCode) {
      add(
        'DESTINO_CODIGO',
        'Codigo SENASA de la sala',
        missing,
        'Falta el codigo SENASA de la sala (ej. SEF-B-20010).',
      );
    } else {
      const status = registryStatus(ctx.destination.senasaStatus);
      add(
        'DESTINO_CODIGO',
        'Codigo SENASA de la sala',
        status,
        status === 'ok'
          ? `${salaCode} habilitada.`
          : status === 'warning'
            ? `${salaCode} cargada a mano, sin verificar contra SENASA.`
            : `${salaCode} no esta habilitada (${ctx.destination.senasaStatus}).`,
      );
      if (!SALA_CODE_PATTERN.test(salaCode)) {
        add(
          'DESTINO_CODIGO_FORMATO',
          'Formato del codigo de sala',
          'warning',
          `${salaCode} no sigue el formato SEF-Letra-N° (ej. SEF-B-20010).`,
        );
      }
      if (ctx.destination.senasaValidTo && ctx.destination.senasaValidTo < draft.loadDate) {
        add(
          'DESTINO_VIGENCIA',
          'Vigencia de la sala',
          'error',
          `La habilitacion de la sala vence el ${ctx.destination.senasaValidTo}, antes de la fecha de carga.`,
        );
      }
    }

    // ---------------------------------------------------------------- fechas
    if (isIsoDate(draft.loadDate) && isIsoDate(draft.expiryDate)) {
      const days = daysBetween(draft.loadDate, draft.expiryDate);
      if (!validateValidity(draft.loadDate, draft.expiryDate)) {
        add(
          'VIGENCIA',
          'Vigencia',
          'ok',
          `Del ${draft.loadDate} 00:00 al ${draft.expiryDate} 23:59 (${days} dias).`,
        );
      }
      const anticipation = validateAnticipation(draft.loadDate, options.now);
      add(
        'ANTICIPACION',
        'Plazo de solicitud',
        anticipation ? (options.forSubmission ? 'error' : 'info') : 'ok',
        anticipation?.message ??
          `Dentro del plazo de autogestion (hasta ${DTE_RULES.maxAnticipationDays} dias antes de la carga).`,
      );
    }

    // -------------------------------------------------------------- cantidad
    if (draft.declaredQuantity === null) {
      add('CANTIDAD', 'Alzas declaradas', missing, 'Falta la cantidad de alzas declaradas.');
    } else if (draft.estimatedQuantity !== null) {
      const suggested = suggestDeclaredQuantity(draft.estimatedQuantity);
      add(
        'CANTIDAD',
        'Alzas declaradas',
        draft.declaredQuantity < suggested ? 'warning' : 'ok',
        draft.declaredQuantity < suggested
          ? `Declaras ${draft.declaredQuantity} para ${draft.estimatedQuantity} estimadas. Sugerimos al menos ${suggested}: si a la sala llegan mas alzas que las declaradas, el DT-e se anula y hay que emitir otro.`
          : `${draft.declaredQuantity} declaradas para ${draft.estimatedQuantity} estimadas: margen suficiente.`,
      );
    } else {
      add(
        'CANTIDAD',
        'Alzas declaradas',
        'ok',
        `${draft.declaredQuantity} alzas declaradas. Conviene sobreestimar: la sala no puede confirmar mas.`,
      );
    }

    // ------------------------------------------------------------ transporte
    if (!draft.transportType || !draft.transportPlate) {
      add('TRANSPORTE', 'Transporte', missing, 'Faltan el tipo de vehiculo y la patente.');
    } else {
      const trailer = draft.transportTrailerPlate
        ? ` + acoplado ${draft.transportTrailerPlate}`
        : '';
      add(
        'TRANSPORTE',
        'Transporte',
        'ok',
        `${draft.transportType} ${draft.transportPlate}${trailer}`,
      );
      for (const plate of [draft.transportPlate, draft.transportTrailerPlate]) {
        if (plate && !isArgentinePlate(plate)) {
          add(
            'TRANSPORTE_PATENTE',
            'Formato de patente',
            'warning',
            `La patente ${plate} no tiene formato argentino (AAA999 o AA999AA).`,
          );
        }
      }
    }

    // ----------------------------------------------------------- integracion
    if (this.gateway.mode === 'manual') {
      add('MODO', 'Canal de emision', 'info', this.gateway.description);
    } else if (this.gateway.mode === 'simulado') {
      add('MODO', 'Canal de emision', 'warning', this.gateway.description);
    } else {
      add(
        'MODO',
        'Canal de emision',
        this.gateway.capabilities.emit ? 'ok' : options.forSubmission ? 'error' : 'warning',
        this.gateway.description,
      );
      if (ctx.holder) {
        const [delegation] = await this.db
          .select()
          .from(senasaDelegation)
          .where(
            and(
              eq(senasaDelegation.producerId, ctx.holder.id),
              eq(senasaDelegation.service, 'SIGSA_DTE'),
            ),
          )
          .limit(1);
        add(
          'DELEGACION',
          'Delegacion en ApiTrace',
          delegation?.status === 'ACEPTADA' ? 'ok' : missing,
          delegation?.status === 'ACEPTADA'
            ? `Servicio SIGSA delegado en ApiTrace${delegation.formNumber ? ` (F3283/E ${delegation.formNumber})` : ''}.`
            : 'El titular no delego el servicio SIGSA en ApiTrace (ARCA, Administrador de Relaciones, F3283/E).',
        );
      }
    }

    if (this.gateway.capabilities.registryLookup) {
      await this.addRegistryLookups(ctx, add);
    }

    return checks;
  }

  /** Consulta de padrones en linea, cuando el adaptador la ofrece. */
  private async addRegistryLookups(
    ctx: DteContext,
    add: (code: string, label: string, status: DteCheckStatus, message: string) => void,
  ): Promise<void> {
    try {
      if (ctx.apiary?.renapaCode) {
        const found = await this.gateway.lookupApiary(
          ctx.apiary.renapaCode,
          ctx.holder?.taxId ?? null,
        );
        if (found) {
          add(
            'PADRON_ORIGEN',
            'Padron RENAPA (SENASA)',
            found.status === 'ACTIVE' ? 'ok' : 'error',
            found.status === 'ACTIVE'
              ? `SENASA confirma ${found.code} habilitado.`
              : `SENASA informa ${found.code} en estado ${found.status}.`,
          );
        }
      }
      if (ctx.destination.senasaCode) {
        const found = await this.gateway.lookupSala(ctx.destination.senasaCode);
        if (found) {
          add(
            'PADRON_DESTINO',
            'Padron de salas (SENASA)',
            found.status === 'ACTIVE' ? 'ok' : 'error',
            found.status === 'ACTIVE'
              ? `SENASA confirma ${found.code} habilitada.`
              : `SENASA informa ${found.code} en estado ${found.status}.`,
          );
        }
      }
    } catch (error) {
      add(
        'PADRON',
        'Padrones de SENASA',
        'warning',
        `No se pudo consultar el padron de SENASA: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  assertChecksPass(checks: DteCheck[]): void {
    const errors = checks.filter((check) => check.status === 'error');
    if (errors.length > 0) {
      throw new DomainRuleException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'DTE_VERIFICACION_PREVIA',
        `No se puede solicitar la emision: ${errors.map((check) => check.message).join(' ')}`,
        { checks },
      );
    }
  }

  async contextForNew(apiaryId: string, destinationId: string): Promise<DteContext> {
    const [origenApiary] = await this.db
      .select()
      .from(apiary)
      .where(eq(apiary.id, apiaryId))
      .limit(1);
    if (!origenApiary) throw new NotFoundException('El apiario indicado no existe.');
    const origin = await this.establishments.findRaw(origenApiary.establishmentId);

    const destination = await this.establishments.findRaw(destinationId);
    if (destination.id === origin.id) {
      throw new DomainRuleException(
        HttpStatus.BAD_REQUEST,
        'ORIGEN_IGUAL_DESTINO',
        'El origen y el destino no pueden ser el mismo establecimiento.',
      );
    }
    if (destination.type !== 'SALA_EXTRACCION') {
      throw new DomainRuleException(
        HttpStatus.BAD_REQUEST,
        'DESTINO_NO_ES_SALA',
        'El DT-e API-SEM ampara el traslado hacia una sala de extraccion.',
      );
    }
    return this.completeContext(origin, destination, origenApiary);
  }

  async contextForMovement(target: MovementRow): Promise<DteContext> {
    const parties = await this.establishments.findManyRaw([
      target.originEstablishmentId,
      target.destinationEstablishmentId,
    ]);
    const origin = parties.find((row) => row.id === target.originEstablishmentId);
    const destination = parties.find((row) => row.id === target.destinationEstablishmentId);
    if (!origin || !destination) {
      throw new NotFoundException('No se encontraron los establecimientos del movimiento.');
    }
    const [origenApiary] = target.originApiaryId
      ? await this.db.select().from(apiary).where(eq(apiary.id, target.originApiaryId)).limit(1)
      : [];
    return this.completeContext(origin, destination, origenApiary ?? null);
  }

  private async completeContext(
    origin: EstablishmentRow,
    destination: EstablishmentRow,
    origenApiary: ApiaryRow | null,
  ): Promise<DteContext> {
    let holder: ProducerRow | null = null;
    let holderRenapa: RenapaRow | null = null;
    if (origin.producerId) {
      const [found] = await this.db
        .select()
        .from(producer)
        .where(eq(producer.id, origin.producerId))
        .limit(1);
      holder = found ?? null;
      if (holder) {
        const registrations = await this.db
          .select()
          .from(renapaRegistration)
          .where(eq(renapaRegistration.producerId, holder.id))
          .orderBy(desc(renapaRegistration.createdAt));
        holderRenapa =
          registrations.find((row) => row.status === 'ACTIVE') ?? registrations[0] ?? null;
      }
    }
    return { origin, destination, apiary: origenApiary, holder, holderRenapa };
  }
}
