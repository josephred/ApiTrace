import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser, UserRoleName } from '../types';

export const IS_PUBLIC_KEY = 'apitrace:isPublic';
export const ROLES_KEY = 'apitrace:roles';
export const AUDIT_KEY = 'apitrace:audit';

/** Marca un endpoint como accesible sin token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restringe un endpoint a los roles indicados. */
export const Roles = (...roles: UserRoleName[]) => SetMetadata(ROLES_KEY, roles);

export interface AuditMetadata {
  action: string;
  entityType: string;
}

/** Registra automaticamente un evento de auditoria al completar el handler (CU-33). */
export const Audit = (action: string, entityType: string) =>
  SetMetadata(AUDIT_KEY, { action, entityType } satisfies AuditMetadata);

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);

export const CorrelationId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request & { correlationId?: string }>();
  return request.correlationId;
});
