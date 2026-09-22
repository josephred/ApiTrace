import { HttpStatus } from '@nestjs/common';
import { DomainRuleException } from '../../common/exceptions/domain-rule.exception';
import type { AuthenticatedUser } from '../../common/types';
import type { DteRow } from './dte.queries';

/**
 * Quien puede hacer que con un DT-e. El rol lo filtra el guard; esto agrega la
 * autorizacion contextual (arquitectura, seccion 47): emite y anula la
 * organizacion duena del origen; cierra la duena del destino. ADMIN puede todo.
 */

export const assertIssuer = (
  actor: AuthenticatedUser,
  issuerOrganizationId: string | null,
): void => {
  if (actor.role === 'ADMIN') return;
  if (!actor.organizationId || actor.organizationId !== issuerOrganizationId) {
    throw new DomainRuleException(
      HttpStatus.FORBIDDEN,
      'SOLO_EMISOR',
      'Solo la organizacion titular del origen gestiona la emision y anulacion de este DT-e.',
    );
  }
};

export const assertReceiver = (
  actor: AuthenticatedUser,
  destinationOrganizationId: string | null,
): void => {
  if (actor.role === 'ADMIN') return;
  if (!actor.organizationId || actor.organizationId !== destinationOrganizationId) {
    throw new DomainRuleException(
      HttpStatus.FORBIDDEN,
      'SOLO_DESTINO',
      'Solo la organizacion de destino (la sala) cierra el DT-e o declara que no arribo.',
    );
  }
};

/** Desde donde mira el usuario: emite, recibe o tiene alcance global. */
export const perspectiveOf = (
  row: Pick<DteRow, 'issuerOrganizationId' | 'destinationOrganizationId'>,
  actor: AuthenticatedUser,
): 'emisor' | 'destino' | 'global' => {
  if (actor.organizationId && actor.organizationId === row.issuerOrganizationId) return 'emisor';
  if (actor.organizationId && actor.organizationId === row.destinationOrganizationId)
    return 'destino';
  return 'global';
};
