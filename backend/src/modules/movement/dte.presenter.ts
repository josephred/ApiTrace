import { getTransitSemaphore, type TransitSemaphore } from './dte.rules';

export interface DtePresenterOptions {
  userRole?: string;
  userOrgId?: string | null;
}

export function presentDte(dte: any, options: DtePresenterOptions = {}) {
  if (!dte) return null;

  const isAdmin = options.userRole === 'ADMIN';
  const isIssuer = Boolean(options.userOrgId && dte.issuerOrganizationId === options.userOrgId);
  const isClosed = dte.status === 'CERRADO';

  const canSeeVerificationCode = isAdmin || isIssuer || isClosed;
  const verificationCode = canSeeVerificationCode ? dte.verificationCode : null;

  const semaphoreInfo = getTransitSemaphore({
    status: dte.status,
    loadDate: dte.loadDate,
    expiryDate: dte.expiryDate,
  });

  return {
    ...dte,
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
