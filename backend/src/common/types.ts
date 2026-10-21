export type UserRoleName =
  | 'ADMIN'
  | 'PRODUCTOR'
  | 'SALA'
  | 'TRANSPORTISTA'
  | 'ACOPIADOR'
  | 'FRACCIONADOR'
  | 'LABORATORIO'
  | 'EXPORTADOR'
  | 'AUDITOR'
  | 'CONSULTA';

export interface AuthenticatedUser {
  id: string;
  /** Null en las cuentas que entran con la CUIT (alta del apicultor, migracion 0003). */
  email: string | null;
  fullName: string;
  role: UserRoleName;
  organizationId: string | null;
}

export interface RequestContext {
  user?: AuthenticatedUser;
  correlationId: string;
  ip?: string;
  userAgent?: string;
}

/** Roles con visibilidad transversal a todas las organizaciones. */
export const GLOBAL_SCOPE_ROLES: UserRoleName[] = ['ADMIN', 'AUDITOR'];

/** Roles sin capacidad de escritura sobre el dominio. */
export const READ_ONLY_ROLES: UserRoleName[] = ['AUDITOR', 'CONSULTA'];
