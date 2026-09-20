import { ForbiddenException, HttpStatus, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import {
  apiary,
  dte,
  dteStatusHistory,
  establishment,
  movement,
  organization,
  producer,
  renapaRegistration,
  renspaRegistration,
  senasaDelegation,
} from '../../database/schema';
import { DomainRuleException } from '../../common/exceptions/domain-rule.exception';
import { DomainEvents, EventsService } from '../../common/services/events.service';
import {
  CloseDteDto,
  CreateDteDraftDto,
  DteFilterDto,
  IssueManualDteDto,
  NoArrivalDteDto,
  PreflightCheckDto,
  RegularizeDteDto,
  VoidDteDto,
} from './dto/dte.dto';
import {
  addDaysIso,
  daysBetweenIso,
  DEFAULT_VALIDITY_DAYS,
  DteStatuses,
  isValidPlate,
  MAX_VALIDITY_DAYS,
  MIN_VALIDITY_DAYS,
  normalizePlate,
  suggestDeclaredQuantity,
  toArgentinaDateString,
} from './dte.rules';
import { presentDte, presentDteList } from './dte.presenter';
import { findDteById, findDteByMovementId, getDteHistory, recordStatusHistory } from './dte.queries';
import { SENASA_GATEWAY, type SenasaGateway } from './senasa/senasa.gateway';

export interface CurrentUserContext {
  id: string;
  email: string;
  role: string;
  organizationId: string | null;
}

@Injectable()
export class DteService {
  private readonly logger = new Logger(DteService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(SENASA_GATEWAY) private readonly senasaGateway: SenasaGateway,
    private readonly events: EventsService,
  ) {}

  /**
   * Preflight: evalua exhaustivamente si un movimiento cumple las condiciones
   * para emitir un DT-e segun la normativa SENASA.
   */
  async preflight(dto: PreflightCheckDto, _user: CurrentUserContext) {
    const [mov] = await this.db.select().from(movement).where(eq(movement.id, dto.movementId)).limit(1);
    if (!mov) throw new NotFoundException('Movimiento no encontrado.');

    const checks: Array<{
      key: string;
      label: string;
      passed: boolean;
      message: string;
      severity: 'ERROR' | 'WARNING' | 'INFO';
    }> = [];

    // 1. Origen: establecimiento y RENSPA
    const [originEst] = await this.db.select().from(establishment).where(eq(establishment.id, mov.originEstablishmentId)).limit(1);
    const [originRenspa] = await this.db.select().from(renspaRegistration).where(eq(renspaRegistration.establishmentId, mov.originEstablishmentId)).limit(1);

    if (originRenspa?.number) {
      checks.push({
        key: 'origin_renspa',
        label: 'RENSPA de Origen',
        passed: true,
        message: `Establecimiento de origen habilitado: ${originRenspa.number}`,
        severity: 'INFO',
      });
    } else {
      checks.push({
        key: 'origin_renspa',
        label: 'RENSPA de Origen',
        passed: false,
        message: 'El establecimiento de origen no tiene un RENSPA registrado.',
        severity: 'ERROR',
      });
    }

    // 2. Apiario de origen y RENAPA
    if (mov.originApiaryId) {
      const [apiaryRecord] = await this.db.select().from(apiary).where(eq(apiary.id, mov.originApiaryId)).limit(1);
      if (apiaryRecord?.renapaCode) {
        checks.push({
          key: 'origin_renapa',
          label: 'RENAPA del Apiario',
          passed: true,
          message: `Apiario con registro oficial RENAPA: ${apiaryRecord.renapaCode}`,
          severity: 'INFO',
        });
      } else {
        checks.push({
          key: 'origin_renapa',
          label: 'RENAPA del Apiario',
          passed: false,
          message: 'El apiario de origen no tiene cargado el codigo RENAPA.',
          severity: 'WARNING',
        });
      }
    }

    // 3. Destino: sala habilitada y codigo SENASA
    const [destEst] = await this.db.select().from(establishment).where(eq(establishment.id, mov.destinationEstablishmentId)).limit(1);
    const [destRenspa] = await this.db.select().from(renspaRegistration).where(eq(renspaRegistration.establishmentId, mov.destinationEstablishmentId)).limit(1);

    if (destEst?.senasaCode) {
      checks.push({
        key: 'dest_senasa_code',
        label: 'Habilitacion SENASA Destino',
        passed: true,
        message: `Sala de destino con registro oficial: ${destEst.senasaCode}`,
        severity: 'INFO',
      });
    } else {
      checks.push({
        key: 'dest_senasa_code',
        label: 'Habilitacion SENASA Destino',
        passed: false,
        message: 'La sala de destino no posee codigo de autorizacion SENASA (SEF-Letra-N°).',
        severity: 'WARNING',
      });
    }

    // 4. Delegacion de clave fiscal en ARCA (F3283/E)
    if (originEst?.producerId) {
      const [delegation] = await this.db
        .select()
        .from(senasaDelegation)
        .where(
          and(
            eq(senasaDelegation.producerId, originEst.producerId),
            eq(senasaDelegation.service, 'SIGSA_DTE'),
          ),
        )
        .limit(1);

      if (delegation?.status === 'ACEPTADA') {
        checks.push({
          key: 'senasa_delegation',
          label: 'Delegacion ARCA (SIGSA)',
          passed: true,
          message: 'Servicio SIGSA_DTE delegado y aceptado en ARCA.',
          severity: 'INFO',
        });
      } else {
        checks.push({
          key: 'senasa_delegation',
          label: 'Delegacion ARCA (SIGSA)',
          passed: false,
          message: 'El productor no tiene aceptada la delegacion de SIGSA en ARCA (F3283/E). Podra emitir en modo manual.',
          severity: 'WARNING',
        });
      }
    }

    // 5. Patente de transporte
    const plate = dto.transportPlate ?? mov.driverDocument;
    if (plate && isValidPlate(plate)) {
      checks.push({
        key: 'transport_plate',
        label: 'Patente del Transporte',
        passed: true,
        message: `Patente valida segun formato nacional: ${normalizePlate(plate)}`,
        severity: 'INFO',
      });
    } else {
      checks.push({
        key: 'transport_plate',
        label: 'Patente del Transporte',
        passed: false,
        message: 'La patente informada no cumple con los formatos oficiales vigentes en Argentina.',
        severity: 'ERROR',
      });
    }

    // 6. Fechas de vigencia
    const todayAr = toArgentinaDateString();
    const loadDate = dto.loadDate ?? todayAr;
    const expiryDate = dto.expiryDate ?? addDaysIso(loadDate, 3);
    const duration = daysBetweenIso(loadDate, expiryDate);

    if (loadDate < todayAr) {
      checks.push({
        key: 'validity_dates',
        label: 'Fecha de Carga',
        passed: false,
        message: 'La fecha de carga no puede ser anterior a la fecha actual.',
        severity: 'ERROR',
      });
    } else if (duration < MIN_VALIDITY_DAYS || duration > MAX_VALIDITY_DAYS) {
      checks.push({
        key: 'validity_dates',
        label: 'Plazo de Vigencia',
        passed: false,
        message: `El plazo de vigencia debe ser de entre ${MIN_VALIDITY_DAYS} y ${MAX_VALIDITY_DAYS} dias corridos (seleccionado: ${duration} dias).`,
        severity: 'ERROR',
      });
    } else {
      checks.push({
        key: 'validity_dates',
        label: 'Plazo de Vigencia',
        passed: true,
        message: `Vigencia valida de ${duration} dias (${loadDate} al ${expiryDate}).`,
        severity: 'INFO',
      });
    }

    // 7. Cantidad declarada vs estimada
    const movQty = Number(mov.quantity);
    const declaredQty = dto.declaredQuantity ?? suggestDeclaredQuantity(movQty);
    if (declaredQty < movQty) {
      checks.push({
        key: 'declared_quantity',
        label: 'Cantidad Declarada',
        passed: false,
        message: `La cantidad declarada (${declaredQty}) es menor a la estimada del movimiento (${movQty}). Podria ser rechazada en destino.`,
        severity: 'WARNING',
      });
    } else {
      checks.push({
        key: 'declared_quantity',
        label: 'Cantidad Declarada',
        passed: true,
        message: `Cantidad declarada (${declaredQty}) cubre el total estimado (${movQty}).`,
        severity: 'INFO',
      });
    }

    const hasErrors = checks.some((c) => c.severity === 'ERROR');

    return {
      ready: !hasErrors,
      movementId: mov.id,
      checks,
      suggestedDeclaredQuantity: suggestDeclaredQuantity(movQty),
      defaultDates: {
        loadDate: todayAr,
        expiryDate: addDaysIso(todayAr, DEFAULT_VALIDITY_DAYS),
      },
    };
  }

  /**
   * Crea un borrador de DT-e asociado a un movimiento.
   */
  async createDraft(dto: CreateDteDraftDto, user: CurrentUserContext) {
    const [mov] = await this.db.select().from(movement).where(eq(movement.id, dto.movementId)).limit(1);
    if (!mov) throw new NotFoundException('Movimiento no encontrado.');

    if (mov.status === 'CANCELLED' || mov.status === 'REJECTED') {
      throw new DomainRuleException(
        HttpStatus.BAD_REQUEST,
        'MOVIMIENTO_NO_DISPONIBLE',
        'No se puede emitir DT-e para un movimiento cancelado o rechazado.',
      );
    }

    // Verificar si ya existe un DT-e activo para este movimiento
    const existing = await findDteByMovementId(this.db, mov.id);
    if (
      existing &&
      [DteStatuses.BORRADOR, DteStatuses.SOLICITADO, DteStatuses.EMITIDO, DteStatuses.VIGENTE].includes(
        existing.status as any,
      )
    ) {
      throw new DomainRuleException(
        HttpStatus.CONFLICT,
        'DTE_ACTIVO_EXISTENTE',
        `Ya existe un DT-e en estado ${existing.status} para este movimiento.`,
      );
    }

    // Validar patente
    if (!isValidPlate(dto.transportPlate)) {
      throw new DomainRuleException(
        HttpStatus.BAD_REQUEST,
        'PATENTE_INVALIDA',
        'La patente de transporte no respeta el formato automotor oficial de Argentina.',
      );
    }

    // Validar vigencia
    const todayAr = toArgentinaDateString();
    if (dto.loadDate < todayAr) {
      throw new DomainRuleException(
        HttpStatus.BAD_REQUEST,
        'FECHA_CARGA_PASADA',
        'La fecha de carga no puede ser anterior al dia de hoy.',
      );
    }
    const days = daysBetweenIso(dto.loadDate, dto.expiryDate);
    if (days < MIN_VALIDITY_DAYS || days > MAX_VALIDITY_DAYS) {
      throw new DomainRuleException(
        HttpStatus.BAD_REQUEST,
        'VIGENCIA_FUERA_DE_RANGO',
        `El plazo de vigencia debe ser de entre ${MIN_VALIDITY_DAYS} y ${MAX_VALIDITY_DAYS} dias corridos (especificado: ${days} dias).`,
      );
    }

    // Resolucion de entidades asociadas
    const [originEst] = await this.db.select().from(establishment).where(eq(establishment.id, mov.originEstablishmentId)).limit(1);
    const [destEst] = await this.db.select().from(establishment).where(eq(establishment.id, mov.destinationEstablishmentId)).limit(1);
    const [originRenspa] = await this.db.select().from(renspaRegistration).where(eq(renspaRegistration.establishmentId, mov.originEstablishmentId)).limit(1);
    const [destRenspa] = await this.db.select().from(renspaRegistration).where(eq(renspaRegistration.establishmentId, mov.destinationEstablishmentId)).limit(1);

    // Aislamiento: solo el emisor de origen (o ADMIN) puede crear el borrador
    if (user.role !== 'ADMIN' && originEst?.organizationId && originEst.organizationId !== user.organizationId) {
      throw new ForbiddenException('No tiene permisos para crear un DT-e para un establecimiento de otra organización.');
    }

    let originCode = originRenspa?.number ?? originEst?.name ?? null;
    if (mov.originApiaryId) {
      const [apiaryRecord] = await this.db.select().from(apiary).where(eq(apiary.id, mov.originApiaryId)).limit(1);
      if (apiaryRecord?.renapaCode) {
        originCode = apiaryRecord.renapaCode;
      }
    }

    const isHoney = mov.materialType === 'MIEL' || (mov.movementType as string) === 'MATERIAL_MELARIO';
    const productCode = isHoney ? '24.45' : mov.materialType;
    const productName = mov.movementType === 'MATERIAL_MELARIO' ? 'Alzas con miel' : 'Miel a granel';

    const [created] = await this.db
      .insert(dte)
      .values({
        movementId: mov.id,
        status: DteStatuses.BORRADOR,
        loadDate: dto.loadDate,
        expiryDate: dto.expiryDate,
        declaredQuantity: Math.round(dto.declaredQuantity),
        estimatedQuantity: Math.round(Number(mov.quantity)),
        unit: mov.unit,
        movementTypeCode: mov.movementType,
        transitReason: dto.transitReason ?? 'EXTRACCION',
        productCode,
        productName,
        issuerOrganizationId: user.organizationId,
        destinationOrganizationId: destEst?.organizationId ?? null,
        holderProducerId: dto.holderProducerId ?? originEst?.producerId ?? null,
        originRenspa: originRenspa?.number ?? null,
        destinationRenspa: destRenspa?.number ?? null,
        originCode,
        destinationCode: destEst?.senasaCode ?? null,
        transportType: dto.transportType ?? 'PROPIO',
        transportPlate: normalizePlate(dto.transportPlate),
        transportTrailerPlate: dto.transportTrailerPlate ? normalizePlate(dto.transportTrailerPlate) : null,
        issueMode: 'MANUAL',
        syncStatus: 'NOT_APPLICABLE',
      })
      .returning();

    await recordStatusHistory(this.db, {
      dteId: created.id,
      fromStatus: null,
      toStatus: DteStatuses.BORRADOR,
      actorUserId: user.id,
      reason: 'Borrador de DT-e inicializado.',
    });

    await this.events.publish({
      eventType: DomainEvents.DteCreated,
      entityType: 'dte',
      entityId: created.id,
      actorUserId: user.id,
      organizationId: user.organizationId,
      payload: { movementId: mov.id, declaredQuantity: dto.declaredQuantity },
    });

    return presentDte(created, { userRole: user.role, userOrgId: user.organizationId });
  }

  /**
   * Emision manual (contingencia / carga directa con numero y codigo oficial de SIGSA).
   */
  async issueManual(id: string, dto: IssueManualDteDto, user: CurrentUserContext) {
    const item = await findDteById(this.db, id);
    if (!item) throw new NotFoundException('DT-e no encontrado.');

    // Aislamiento: solo la organizacion emisora (o ADMIN) puede registrar la emision
    if (user.role !== 'ADMIN' && item.issuerOrganizationId && item.issuerOrganizationId !== user.organizationId) {
      throw new ForbiddenException('No tiene permisos para emitir un DT-e de otra organización.');
    }

    if (item.status !== DteStatuses.BORRADOR && item.status !== DteStatuses.SOLICITADO) {
      throw new DomainRuleException(
        HttpStatus.BAD_REQUEST,
        'ESTADO_INVALIDO_PARA_EMISION',
        `No se puede emitir un DT-e en estado ${item.status}.`,
      );
    }

    const issuedAt = dto.issuedAt ? new Date(dto.issuedAt) : new Date();

    const [updated] = await this.db
      .update(dte)
      .set({
        number: dto.number.trim(),
        verificationCode: dto.verificationCode.trim(),
        pdfUrl: dto.pdfUrl?.trim() ?? null,
        status: DteStatuses.EMITIDO,
        issuedAt,
        issueMode: 'MANUAL',
        syncStatus: 'SYNCHRONIZED',
        updatedAt: new Date(),
      })
      .where(eq(dte.id, id))
      .returning();

    // Actualizar movimiento para requerir documento
    await this.db
      .update(movement)
      .set({
        requiresDocument: true,
        requiredDocumentType: 'DTE',
        updatedAt: new Date(),
      })
      .where(eq(movement.id, item.movementId));

    await recordStatusHistory(this.db, {
      dteId: item.id,
      fromStatus: item.status,
      toStatus: DteStatuses.EMITIDO,
      actorUserId: user.id,
      reason: `Emision manual con numero oficial ${dto.number}`,
    });

    await this.events.publish({
      eventType: DomainEvents.DteIssued,
      entityType: 'dte',
      entityId: item.id,
      actorUserId: user.id,
      organizationId: user.organizationId,
      payload: { number: dto.number, issueMode: 'MANUAL' },
    });

    return presentDte(updated, { userRole: user.role, userOrgId: user.organizationId });
  }

  /**
   * Solicita la emision del DT-e al gateway (Simulador o SIGSA).
   */
  async requestSigsa(id: string, user: CurrentUserContext, correlationId?: string) {
    const item = await findDteById(this.db, id);
    if (!item) throw new NotFoundException('DT-e no encontrado.');

    // Aislamiento: solo la organizacion emisora (o ADMIN) puede solicitar la emision
    if (user.role !== 'ADMIN' && item.issuerOrganizationId && item.issuerOrganizationId !== user.organizationId) {
      throw new ForbiddenException('No tiene permisos para solicitar la emisión de un DT-e de otra organización.');
    }

    if (item.status !== DteStatuses.BORRADOR && item.status !== DteStatuses.RECHAZADO) {
      throw new DomainRuleException(
        HttpStatus.BAD_REQUEST,
        'ESTADO_INVALIDO_PARA_SOLICITUD',
        `El DT-e se encuentra en estado ${item.status}.`,
      );
    }

    // Actualizar estado a SOLICITADO
    await this.db
      .update(dte)
      .set({
        status: DteStatuses.SOLICITADO,
        requestedAt: new Date(),
        requestedById: user.id,
        syncStatus: 'PENDING_SYNC',
        updatedAt: new Date(),
      })
      .where(eq(dte.id, id));

    await recordStatusHistory(this.db, {
      dteId: item.id,
      fromStatus: item.status,
      toStatus: DteStatuses.SOLICITADO,
      actorUserId: user.id,
      correlationId,
      reason: 'Solicitud enviada al servicio API-SEM de SENASA.',
    });

    await this.events.publish({
      eventType: DomainEvents.DteRequested,
      entityType: 'dte',
      entityId: item.id,
      actorUserId: user.id,
      organizationId: user.organizationId,
      correlationId,
      payload: { movementId: item.movementId },
    });

    try {
      const loadDateIso = item.loadDate ?? toArgentinaDateString();
      const expiryDateIso = item.expiryDate ?? addDaysIso(loadDateIso, 3);

      const sigsaResult = await this.senasaGateway.requestDte({
        movementId: item.movementId,
        originRenspa: item.originRenspa,
        destinationRenspa: item.destinationRenspa,
        originCode: item.originCode,
        destinationCode: item.destinationCode,
        holderTaxId: item.holderTaxId,
        loadDate: loadDateIso,
        expiryDate: expiryDateIso,
        declaredQuantity: Number(item.declaredQuantity),
        unit: item.unit ?? 'ALZA',
        productCode: item.productCode ?? 'MIEL',
        productName: item.productName ?? 'Miel a granel',
        transportType: item.transportType ?? 'PROPIO',
        transportPlate: item.transportPlate ?? '',
        transportTrailerPlate: item.transportTrailerPlate,
        transitReason: item.transitReason ?? 'EXTRACCION',
        correlationId,
      });

      const [updated] = await this.db
        .update(dte)
        .set({
          number: sigsaResult.number,
          verificationCode: sigsaResult.verificationCode,
          externalId: sigsaResult.externalId,
          pdfUrl: sigsaResult.pdfUrl,
          status: DteStatuses.EMITIDO,
          issuedAt: sigsaResult.issuedAt,
          feePaid: sigsaResult.feePaid ?? true,
          syncStatus: 'SYNCHRONIZED',
          updatedAt: new Date(),
        })
        .where(eq(dte.id, id))
        .returning();

      await this.db
        .update(movement)
        .set({ requiresDocument: true, requiredDocumentType: 'DTE', updatedAt: new Date() })
        .where(eq(movement.id, item.movementId));

      await recordStatusHistory(this.db, {
        dteId: item.id,
        fromStatus: DteStatuses.SOLICITADO,
        toStatus: DteStatuses.EMITIDO,
        actorUserId: user.id,
        correlationId,
        reason: `Autorizado por SENASA con numero ${sigsaResult.number}`,
      });

      await this.events.publish({
        eventType: DomainEvents.DteIssued,
        entityType: 'dte',
        entityId: item.id,
        actorUserId: user.id,
        organizationId: user.organizationId,
        correlationId,
        payload: { number: sigsaResult.number, verificationCode: sigsaResult.verificationCode },
      });

      return presentDte(updated, { userRole: user.role, userOrgId: user.organizationId });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await this.db
        .update(dte)
        .set({
          syncStatus: 'ERROR',
          errorMessage: errorMsg.slice(0, 600),
          updatedAt: new Date(),
        })
        .where(eq(dte.id, id));
      throw err;
    }
  }

  /**
   * Anula un DT-e emitido o vigente.
   */
  async voidDte(id: string, dto: VoidDteDto, user: CurrentUserContext, correlationId?: string) {
    const item = await findDteById(this.db, id);
    if (!item) throw new NotFoundException('DT-e no encontrado.');

    // Aislamiento: solo la organizacion emisora (o ADMIN) puede anular
    if (user.role !== 'ADMIN' && item.issuerOrganizationId && item.issuerOrganizationId !== user.organizationId) {
      throw new ForbiddenException('No tiene permisos para anular un DT-e emitido por otra organización.');
    }

    if (item.status !== DteStatuses.EMITIDO && item.status !== DteStatuses.VIGENTE) {
      throw new DomainRuleException(
        HttpStatus.BAD_REQUEST,
        'ESTADO_INVALIDO_PARA_ANULACION',
        `No se puede anular un DT-e en estado ${item.status}. Solo se pueden anular documentos EMITIDOS o VIGENTES.`,
      );
    }

    if (item.number) {
      await this.senasaGateway.voidDte({
        dteNumber: item.number,
        reason: dto.reason,
        externalId: item.externalId,
        correlationId,
      });
    }

    const [updated] = await this.db
      .update(dte)
      .set({
        status: DteStatuses.ANULADO,
        voidedAt: new Date(),
        voidReason: dto.reason.trim(),
        syncStatus: 'SYNCHRONIZED',
        updatedAt: new Date(),
      })
      .where(eq(dte.id, id))
      .returning();

    await recordStatusHistory(this.db, {
      dteId: item.id,
      fromStatus: item.status,
      toStatus: DteStatuses.ANULADO,
      actorUserId: user.id,
      correlationId,
      reason: dto.reason,
    });

    await this.events.publish({
      eventType: DomainEvents.DteVoided,
      entityType: 'dte',
      entityId: item.id,
      actorUserId: user.id,
      organizationId: user.organizationId,
      correlationId,
      payload: { reason: dto.reason },
    });

    return presentDte(updated, { userRole: user.role, userOrgId: user.organizationId });
  }

  /**
   * Cierra el DT-e en la sala de extraccion de destino (SITA / API-SEM).
   */
  async closeDte(id: string, dto: CloseDteDto, user: CurrentUserContext, correlationId?: string) {
    const item = await findDteById(this.db, id);
    if (!item) throw new NotFoundException('DT-e no encontrado.');

    // Aislamiento: solo la organizacion de destino (o ADMIN) puede cerrar el DT-e
    if (user.role !== 'ADMIN' && item.destinationOrganizationId && item.destinationOrganizationId !== user.organizationId) {
      throw new ForbiddenException('No tiene permisos para cerrar un DT-e destinado a otra organización.');
    }

    if (![DteStatuses.VIGENTE, DteStatuses.VENCIDO, DteStatuses.CADUCADO].includes(item.status as any)) {
      throw new DomainRuleException(
        HttpStatus.BAD_REQUEST,
        'ESTADO_INVALIDO_PARA_CIERRE',
        `El DT-e se encuentra en estado ${item.status}. Solo puede cerrarse cuando ha arribado a sala en vigencia o estado vencido/caducado.`,
      );
    }

    // Regla de oro: Validar codigo de verificacion de cierre oficial
    const providedCode = dto.verificationCode.trim().toUpperCase();
    const storedCode = (item.verificationCode ?? '').trim().toUpperCase();

    if (storedCode && providedCode !== storedCode) {
      throw new DomainRuleException(
        HttpStatus.BAD_REQUEST,
        'CODIGO_VERIFICACION_INVALIDO',
        'El codigo de verificacion ingresado no coincide con el codigo impreso en el DT-e oficial presentado por el transportista.',
      );
    }

    // Regla de oro: La cantidad arribada no puede superar la declarada
    const declaredQty = Number(item.declaredQuantity);
    if (dto.confirmedQuantity > declaredQty) {
      throw new DomainRuleException(
        HttpStatus.BAD_REQUEST,
        'EXCESO_CANTIDAD_DECLARADA',
        `La cantidad recibida (${dto.confirmedQuantity}) supera la cantidad declarada en el DT-e (${declaredQty}). La normativa prohibe ingresar material excedente bajo el mismo documento.`,
        { declaredQuantity: declaredQty, attemptedQuantity: dto.confirmedQuantity },
      );
    }

    // Notificar a SENASA SITA
    if (item.number) {
      await this.senasaGateway.closeDte({
        dteNumber: item.number,
        verificationCode: providedCode,
        confirmedQuantity: dto.confirmedQuantity,
        arrivalAt: dto.arrivalAt ? new Date(dto.arrivalAt) : new Date(),
        correlationId,
      });
    }

    const [updated] = await this.db
      .update(dte)
      .set({
        status: DteStatuses.CERRADO,
        confirmedQuantity: Math.round(dto.confirmedQuantity),
        arrivalAt: dto.arrivalAt ? new Date(dto.arrivalAt) : new Date(),
        closedAt: new Date(),
        syncStatus: 'SYNCHRONIZED',
        updatedAt: new Date(),
      })
      .where(eq(dte.id, id))
      .returning();

    await recordStatusHistory(this.db, {
      dteId: item.id,
      fromStatus: item.status,
      toStatus: DteStatuses.CERRADO,
      actorUserId: user.id,
      correlationId,
      reason: `Cierre en sala con cantidad ${dto.confirmedQuantity}`,
    });

    await this.events.publish({
      eventType: DomainEvents.DteClosed,
      entityType: 'dte',
      entityId: item.id,
      actorUserId: user.id,
      organizationId: user.organizationId,
      correlationId,
      payload: { confirmedQuantity: dto.confirmedQuantity },
    });

    return presentDte(updated, { userRole: user.role, userOrgId: user.organizationId });
  }

  /**
   * Reporta el DT-e como "Sin Arribo".
   */
  async reportNoArrival(id: string, dto: NoArrivalDteDto, user: CurrentUserContext, correlationId?: string) {
    const item = await findDteById(this.db, id);
    if (!item) throw new NotFoundException('DT-e no encontrado.');

    if (item.status !== DteStatuses.VIGENTE && item.status !== DteStatuses.VENCIDO) {
      throw new DomainRuleException(
        HttpStatus.BAD_REQUEST,
        'ESTADO_INVALIDO_PARA_SIN_ARRIBO',
        `No se puede declarar sin arribo un DT-e en estado ${item.status}.`,
      );
    }

    if (item.number) {
      await this.senasaGateway.reportNoArrival({
        dteNumber: item.number,
        reason: dto.reason,
        correlationId,
      });
    }

    const [updated] = await this.db
      .update(dte)
      .set({
        status: DteStatuses.SIN_ARRIBO,
        voidReason: dto.reason.trim(),
        syncStatus: 'SYNCHRONIZED',
        updatedAt: new Date(),
      })
      .where(eq(dte.id, id))
      .returning();

    await recordStatusHistory(this.db, {
      dteId: item.id,
      fromStatus: item.status,
      toStatus: DteStatuses.SIN_ARRIBO,
      actorUserId: user.id,
      correlationId,
      reason: dto.reason,
    });

    await this.events.publish({
      eventType: DomainEvents.DteNoArrival,
      entityType: 'dte',
      entityId: item.id,
      actorUserId: user.id,
      organizationId: user.organizationId,
      correlationId,
      payload: { reason: dto.reason },
    });

    return presentDte(updated, { userRole: user.role, userOrgId: user.organizationId });
  }

  /**
   * Regulariza un DT-e vencido o caducado.
   */
  async regularize(id: string, dto: RegularizeDteDto, user: CurrentUserContext) {
    const item = await findDteById(this.db, id);
    if (!item) throw new NotFoundException('DT-e no encontrado.');

    if (item.status !== DteStatuses.VENCIDO && item.status !== DteStatuses.CADUCADO) {
      throw new DomainRuleException(
        HttpStatus.BAD_REQUEST,
        'NO_REQUIERE_REGULARIZACION',
        `El DT-e se encuentra en estado ${item.status}. Solo DT-e VENCIDOS o CADUCADOS pueden regularizarse.`,
      );
    }

    const declaredQty = Number(item.declaredQuantity);
    if (dto.confirmedQuantity > declaredQty) {
      throw new DomainRuleException(
        HttpStatus.BAD_REQUEST,
        'EXCESO_CANTIDAD_DECLARADA',
        `La cantidad regularizada (${dto.confirmedQuantity}) supera la declarada (${declaredQty}).`,
      );
    }

    const [updated] = await this.db
      .update(dte)
      .set({
        status: DteStatuses.CERRADO,
        confirmedQuantity: Math.round(dto.confirmedQuantity),
        regularizedAt: new Date(),
        regularizedById: user.id,
        regularizationNote: dto.regularizationNote.trim(),
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(dte.id, id))
      .returning();

    await recordStatusHistory(this.db, {
      dteId: item.id,
      fromStatus: item.status,
      toStatus: DteStatuses.CERRADO,
      actorUserId: user.id,
      reason: `Regularizado extemporaneamente: ${dto.regularizationNote}`,
    });

    await this.events.publish({
      eventType: DomainEvents.DteRegularized,
      entityType: 'dte',
      entityId: item.id,
      actorUserId: user.id,
      organizationId: user.organizationId,
      payload: { confirmedQuantity: dto.confirmedQuantity, note: dto.regularizationNote },
    });

    return presentDte(updated, { userRole: user.role, userOrgId: user.organizationId });
  }

  /**
   * Obtiene un DT-e por su identificador unico.
   */
  async getById(id: string, user: CurrentUserContext) {
    const item = await findDteById(this.db, id);
    if (!item) throw new NotFoundException('DT-e no encontrado.');

    const history = await getDteHistory(this.db, id);

    const presented = presentDte(item, {
      userRole: user.role,
      userOrgId: user.organizationId,
    });

    return {
      ...presented,
      history,
    };
  }

  /**
   * Obtiene el DT-e activo de un movimiento.
   */
  async getByMovementId(movementId: string, user: CurrentUserContext) {
    const item = await findDteByMovementId(this.db, movementId);
    if (!item) return null;

    const history = await getDteHistory(this.db, item.id);
    const presented = presentDte(item, {
      userRole: user.role,
      userOrgId: user.organizationId,
    });

    return {
      ...presented,
      history,
    };
  }

  /**
   * Listado paginado de DT-e con filtros de organizacion y perspectiva.
   */
  async list(filter: DteFilterDto, user: CurrentUserContext) {
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const conditions: SQL[] = [];

    // Filtro por organizacion y perspectiva
    const isAdmin = user.role === 'ADMIN';
    const orgId = user.organizationId;

    if (!isAdmin && orgId) {
      if (filter.perspective === 'RECEIVED') {
        conditions.push(eq(dte.destinationOrganizationId, orgId));
      } else if (filter.perspective === 'ISSUED') {
        conditions.push(eq(dte.issuerOrganizationId, orgId));
      } else {
        conditions.push(
          or(
            eq(dte.issuerOrganizationId, orgId),
            eq(dte.destinationOrganizationId, orgId),
          )!,
        );
      }
    } else if (isAdmin && orgId) {
      if (filter.perspective === 'RECEIVED') {
        conditions.push(eq(dte.destinationOrganizationId, orgId));
      } else if (filter.perspective === 'ISSUED') {
        conditions.push(eq(dte.issuerOrganizationId, orgId));
      }
    }

    if (filter.status) {
      conditions.push(eq(dte.status, filter.status));
    }

    if (filter.search) {
      const term = `%${filter.search.trim()}%`;
      conditions.push(
        or(
          ilike(dte.number, term),
          ilike(dte.originRenspa, term),
          ilike(dte.destinationRenspa, term),
          ilike(dte.transportPlate, term),
        )!,
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(dte)
        .where(where)
        .orderBy(desc(dte.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(dte)
        .where(where),
    ]);

    return {
      data: presentDteList(rows, { userRole: user.role, userOrgId: user.organizationId }),
      meta: {
        page,
        pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize),
      },
    };
  }

  /**
   * Resumen de tareas y estados del DT-e para el panel del usuario.
   */
  async summary(user: CurrentUserContext) {
    const orgId = user.organizationId;
    const isAdmin = user.role === 'ADMIN';

    const baseCondition =
      !isAdmin && orgId
        ? or(eq(dte.issuerOrganizationId, orgId), eq(dte.destinationOrganizationId, orgId))
        : sql`1=1`;

    const rows = await this.db
      .select({
        status: dte.status,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(dte)
      .where(baseCondition)
      .groupBy(dte.status);

    const counts: Record<string, number> = {};
    for (const r of rows) {
      counts[r.status] = r.count;
    }

    return {
      borradores: counts[DteStatuses.BORRADOR] ?? 0,
      solicitados: counts[DteStatuses.SOLICITADO] ?? 0,
      emitidos: counts[DteStatuses.EMITIDO] ?? 0,
      vigentes: counts[DteStatuses.VIGENTE] ?? 0,
      vencidos: counts[DteStatuses.VENCIDO] ?? 0,
      caducados: counts[DteStatuses.CADUCADO] ?? 0,
      cerrados: counts[DteStatuses.CERRADO] ?? 0,
      total: Object.values(counts).reduce((acc, v) => acc + v, 0),
    };
  }

  // Metodos de compatibilidad hacia atras para MovementController
  async create(movementId: string, dto: any, actor: any, correlationId?: string) {
    const [mov] = await this.db.select().from(movement).where(eq(movement.id, movementId)).limit(1);
    if (!mov) throw new NotFoundException('Movimiento no encontrado.');

    let item = await findDteByMovementId(this.db, movementId);
    if (!item) {
      const todayAr = toArgentinaDateString();
      item = (await this.createDraft(
        {
          movementId,
          loadDate: todayAr,
          expiryDate: addDaysIso(todayAr, DEFAULT_VALIDITY_DAYS),
          declaredQuantity: Number(mov.quantity),
          transportPlate: dto.transportPlate ? normalizePlate(dto.transportPlate) : 'AF123AA',
        },
        actor,
      )) as any;
    }

    if (dto.number) {
      const verificationCode = dto.verificationCode?.trim() || `VER-${Math.floor(1000 + Math.random() * 9000)}`;
      return this.issueManual(
        item.id,
        {
          number: dto.number,
          verificationCode,
          issuedAt: dto.issuedAt,
        },
        actor,
      );
    }
    return item;
  }

  async getByMovement(movementId: string, actor: any) {
    return this.getByMovementId(movementId, actor);
  }

  async updateStatus(movementId: string, dto: any, actor: any, correlationId?: string) {
    const item = await findDteByMovementId(this.db, movementId);
    if (!item) throw new NotFoundException('DT-e no encontrado.');

    if (dto.status === 'CANCELLED') {
      return this.voidDte(item.id, { reason: dto.reason ?? 'Anulado' }, actor, correlationId);
    }

    const [updated] = await this.db
      .update(dte)
      .set({
        status: dto.status,
        number: dto.number ?? item.number,
        updatedAt: new Date(),
      })
      .where(eq(dte.id, item.id))
      .returning();

    return presentDte(updated, { userRole: actor.role, userOrgId: actor.organizationId });
  }

  async close(movementId: string, dto: any, actor: any, correlationId?: string) {
    const item = await findDteByMovementId(this.db, movementId);
    if (!item) throw new NotFoundException('DT-e no encontrado.');

    if (!dto?.verificationCode?.trim()) {
      throw new DomainRuleException(
        HttpStatus.BAD_REQUEST,
        'CODIGO_VERIFICACION_REQUERIDO',
        'Se requiere ingresar el código de verificación oficial impreso en el DT-e físico.',
      );
    }

    return this.closeDte(
      item.id,
      {
        verificationCode: dto.verificationCode.trim(),
        confirmedQuantity: Number(dto.confirmedQuantity ?? item.declaredQuantity ?? 0),
        notes: dto.notes,
        arrivalAt: dto.arrivalAt,
      },
      actor,
      correlationId,
    );
  }
}

