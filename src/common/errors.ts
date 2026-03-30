export type CarrierErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_ERROR"
  | "HTTP_ERROR"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "MALFORMED_RESPONSE"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export interface CarrierErrorDetails {
  code: CarrierErrorCode;
  message: string;
  context?: Record<string, string | number | boolean | undefined>;
  cause?: unknown;
}

export class CarrierIntegrationError extends Error {
  readonly code: CarrierErrorCode;
  readonly context?: Record<string, string | number | boolean | undefined>;
  override readonly cause?: unknown;

  constructor(details: CarrierErrorDetails) {
    super(details.message);
    this.name = "CarrierIntegrationError";
    this.code = details.code;
    this.context = details.context;
    this.cause = details.cause;
  }

  toJSON(): CarrierErrorDetails {
    return {
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}

export function isCarrierIntegrationError(e: unknown): e is CarrierIntegrationError {
  return e instanceof CarrierIntegrationError;
}
