import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { movementRule } from '../../database/schema';

export interface RuleQuery {
  movementType: string;
  materialType: string;
  originType: string;
  destinationType: string;
  at: Date;
}

export interface RuleDecision {
  requiresDocument: boolean;
  requiredDocumentType: string | null;
  ruleId: string | null;
  ruleName: string | null;
  legalReference: string | null;
}

/**
 * Motor de reglas normativas (arquitectura, secciones 71-72).
 *
 * La normativa cambia sin que cambie la arquitectura: la exigencia de DT-e para
 * material melario apiario -> sala rige desde el 01/08/2026, y una consulta con
 * fecha anterior debe seguir devolviendo la regla que estaba vigente entonces.
 * Por eso la evaluacion recibe la fecha del movimiento, no la fecha actual.
 *
 * Una columna en NULL actua como comodin; gana la regla mas especifica
 * (menor `priority`) y, ante empate, la de vigencia mas reciente.
 */
@Injectable()
export class MovementRuleService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async evaluate(query: RuleQuery): Promise<RuleDecision> {
    const matches = await this.db
      .select()
      .from(movementRule)
      .where(
        and(
          eq(movementRule.active, true),
          lte(movementRule.effectiveFrom, query.at),
          or(isNull(movementRule.effectiveTo), gt(movementRule.effectiveTo, query.at)),
          or(
            isNull(movementRule.movementType),
            eq(movementRule.movementType, query.movementType as never),
          ),
          or(
            isNull(movementRule.materialType),
            eq(movementRule.materialType, query.materialType as never),
          ),
          or(isNull(movementRule.originType), eq(movementRule.originType, query.originType as never)),
          or(
            isNull(movementRule.destinationType),
            eq(movementRule.destinationType, query.destinationType as never),
          ),
        ),
      )
      .orderBy(asc(movementRule.priority), desc(movementRule.effectiveFrom))
      .limit(1);

    const rule = matches[0];
    if (!rule) {
      return {
        requiresDocument: false,
        requiredDocumentType: null,
        ruleId: null,
        ruleName: null,
        legalReference: null,
      };
    }

    return {
      requiresDocument: rule.requiresDocument,
      requiredDocumentType: rule.requiredDocumentType,
      ruleId: rule.id,
      ruleName: rule.name,
      legalReference: rule.legalReference,
    };
  }

  async list() {
    return this.db
      .select()
      .from(movementRule)
      .orderBy(asc(movementRule.priority), desc(movementRule.effectiveFrom));
  }

  /** Reglas vigentes en una fecha dada, para inspeccion y diagnostico. */
  async listEffective(at: Date) {
    return this.db
      .select()
      .from(movementRule)
      .where(
        and(
          eq(movementRule.active, true),
          lte(movementRule.effectiveFrom, at),
          or(isNull(movementRule.effectiveTo), gt(movementRule.effectiveTo, at)),
        ),
      )
      .orderBy(asc(movementRule.priority));
  }

  async count(): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(movementRule);
    return rows[0]?.count ?? 0;
  }
}
