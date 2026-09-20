import { getTransitSemaphore, type TransitSemaphore } from './dte.rules';

export interface DtePresenterOptions {
  userRole?: string;
  userOrgId?: string | null;
}

function cleanDate(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'string') {
    return val.split(/[T\s]/)[0];
  }
  return null;
}

export function presentDte(dte: any, options: DtePresenterOptions = {}) {
  if (!dte) return null;

  const isAdmin = options.userRole === 'ADMIN';
  const isIssuer = Boolean(options.userOrgId && dte.issuerOrganizationId === options.userOrgId);
  const isClosed = dte.status === 'CERRADO';

  const canSeeVerificationCode = isAdmin || isIssuer || isClosed;
  const verificationCode = canSeeVerificationCode ? dte.verificationCode : null;

  const loadDate = cleanDate(dte.loadDate);
  const expiryDate = cleanDate(dte.expiryDate);

  const semaphoreInfo = getTransitSemaphore({
    status: dte.status,
    loadDate,
    expiryDate,
  });

  return {
    ...dte,
    loadDate,
    expiryDate,
    verificationCode,
    canSeeVerificationCode,
    transitSemaphore: semaphoreInfo.semaphore,
    transitReasonText: semaphoreInfo.reason,
    canTransit: semaphoreInfo.canTransit,
  };
}

export function presentDteList(dtes: any[], options: DtePresenterOptions = {}) {
  return dtes.map((d) => presentDte(d, options));
}
