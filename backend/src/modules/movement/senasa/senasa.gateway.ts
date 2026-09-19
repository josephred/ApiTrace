export interface RequestDteInput {
  movementId: string;
  originRenspa?: string | null;
  destinationRenspa?: string | null;
  originCode?: string | null;
  destinationCode?: string | null;
  holderTaxId?: string | null;
  loadDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  declaredQuantity: number;
  unit: string;
  productCode: string;
  productName: string;
  transportType: string;
  transportPlate: string;
  transportTrailerPlate?: string | null;
  transitReason: string;
  correlationId?: string | null;
}

export interface RequestDteResult {
  externalId: string;
  number: string;
  verificationCode: string;
  pdfUrl?: string | null;
  status: string;
  feePaid?: boolean;
  issuedAt: Date;
}

export interface VoidDteInput {
  dteNumber: string;
  reason: string;
  externalId?: string | null;
  correlationId?: string | null;
}

export interface VoidDteResult {
  success: boolean;
  voidedAt: Date;
  message?: string;
}

export interface CloseDteInput {
  dteNumber: string;
  verificationCode: string;
  confirmedQuantity: number;
  arrivalAt?: Date | null;
  destinationSenasaCode?: string | null;
  correlationId?: string | null;
}

export interface CloseDteResult {
  success: boolean;
  closedAt: Date;
  message?: string;
}

export interface NoArrivalInput {
  dteNumber: string;
  reason: string;
  correlationId?: string | null;
}

export interface NoArrivalResult {
  success: boolean;
  reportedAt: Date;
  message?: string;
}

export const SENASA_GATEWAY = 'SENASA_GATEWAY';

export interface SenasaGateway {
  requestDte(input: RequestDteInput): Promise<RequestDteResult>;
  voidDte(input: VoidDteInput): Promise<VoidDteResult>;
  closeDte(input: CloseDteInput): Promise<CloseDteResult>;
  reportNoArrival(input: NoArrivalInput): Promise<NoArrivalResult>;
}
