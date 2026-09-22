import { HttpStatus } from '@nestjs/common';
import { DomainRuleException } from '../../common/exceptions/domain-rule.exception';
import {
  DTE_RULES,
  defaultExpiryDate,
  isIsoDate,
  normalizePlate,
  suggestDeclaredQuantity,
  toArDate,
  validateValidity,
  type RuleViolation,
} from './dte.rules';
import type { DteRow } from './dte.queries';
import type { DteContext, DraftData } from './dte.types';
import type { DteTransportDto } from './dto/dte.dto';

/**
 * Datos del tramite API-SEM: normalizacion, reglas duras y columnas. Funciones
 * puras, compartidas por la emision (DteService) y la verificacion previa
 * (DteQueryService).
 */

export const normalizeDraft = (input: {
  estimatedQuantity?: number;
  declaredQuantity?: number;
  loadDate: string;
  expiryDate?: string;
  transport?: DteTransportDto;
}): DraftData => ({
  estimatedQuantity: input.estimatedQuantity ?? null,
  declaredQuantity: input.declaredQuantity ?? null,
  loadDate: input.loadDate,
  expiryDate:
    input.expiryDate ??
    (isIsoDate(input.loadDate) ? defaultExpiryDate(input.loadDate) : input.loadDate),
  transportType: input.transport?.type ?? null,
  transportPlate: normalizePlate(input.transport?.plate),
  transportTrailerPlate: normalizePlate(input.transport?.trailerPlate),
});

/** Reglas que ningun DT-e puede violar, ni siquiera como borrador. */
export const draftViolations = (draft: DraftData): RuleViolation[] => {
  const violations: RuleViolation[] = [];
  if (!isIsoDate(draft.loadDate) || !isIsoDate(draft.expiryDate)) {
    violations.push({
      code: 'FECHA_INVALIDA',
      message: 'Las fechas de carga y vencimiento no son validas.',
    });
    return violations;
  }
  const validity = validateValidity(draft.loadDate, draft.expiryDate);
  if (validity) violations.push(validity);
  if (
    draft.estimatedQuantity !== null &&
    draft.declaredQuantity !== null &&
    draft.declaredQuantity < draft.estimatedQuantity
  ) {
    violations.push({
      code: 'DECLARADA_MENOR_A_ESTIMADA',
      message: `Declaraste ${draft.declaredQuantity} alzas pero estimas ${draft.estimatedQuantity}: la sala no podra confirmar mas de lo declarado. Declara al menos ${draft.estimatedQuantity} (sugerido: ${suggestDeclaredQuantity(draft.estimatedQuantity)}).`,
    });
  }
  return violations;
};

export const assertDraftRules = (draft: DraftData): void => {
  const [first] = draftViolations(draft);
  if (first) {
    throw new DomainRuleException(HttpStatus.BAD_REQUEST, first.code, first.message, {
      loadDate: draft.loadDate,
      expiryDate: draft.expiryDate,
      estimatedQuantity: draft.estimatedQuantity,
      declaredQuantity: draft.declaredQuantity,
    });
  }
};

export const draftColumns = (draft: DraftData) => ({
  estimatedQuantity: draft.estimatedQuantity,
  declaredQuantity: draft.declaredQuantity,
  loadDate: draft.loadDate,
  expiryDate: draft.expiryDate,
  transportType: draft.transportType,
  transportPlate: draft.transportPlate,
  transportTrailerPlate: draft.transportTrailerPlate,
});

export const draftOf = (row: DteRow): DraftData => {
  const loadDate = row.loadDate ?? toArDate(new Date());
  return {
    estimatedQuantity: row.estimatedQuantity,
    declaredQuantity: row.declaredQuantity,
    loadDate,
    expiryDate: row.expiryDate ?? defaultExpiryDate(loadDate),
    transportType: row.transportType,
    transportPlate: row.transportPlate,
    transportTrailerPlate: row.transportTrailerPlate,
  };
};

export const transportOf = (row: DteRow): DteTransportDto | undefined => {
  if (!row.transportType || !row.transportPlate) return undefined;
  return {
    type: row.transportType as DteTransportDto['type'],
    plate: row.transportPlate,
    trailerPlate: row.transportTrailerPlate ?? undefined,
  };
};

/** Parametros fijos del movimiento API-SEM (especificacion 4.1). */
export const apiSemDefaults = () => ({
  movementTypeCode: DTE_RULES.movementTypeCode,
  transitReason: DTE_RULES.transitReason,
  productCode: DTE_RULES.productCode,
  productName: DTE_RULES.productName,
  unit: DTE_RULES.unit,
});

/** El traslado se programa a las 08:00 del dia de carga (hora argentina). */
export const scheduledAtFor = (loadDate: string): string =>
  new Date(`${loadDate}T08:00:00.000${DTE_RULES.utcOffset}`).toISOString();

/** Foto de los identificadores oficiales en el momento del alta o la emision. */
export const officialSnapshot = (ctx: DteContext) => ({
  issuerOrganizationId: ctx.origin.organizationId,
  destinationOrganizationId: ctx.destination.organizationId,
  holderProducerId: ctx.holder?.id ?? null,
  holderTaxId: ctx.holder?.taxId ?? null,
  originCode: ctx.apiary?.renapaCode ?? null,
  destinationCode: ctx.destination.senasaCode ?? null,
});
