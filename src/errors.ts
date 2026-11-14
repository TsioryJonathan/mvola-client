export type MvolaOperation = "authentication" | "initiate" | "status" | "details";

/**
 * MVola answered with an HTTP error: the request reached MVola and was refused or failed.
 * `message` carries MVola's own error fields; it never contains credentials or tokens.
 */
export class MvolaError extends Error {
  readonly status: number;
  readonly operation: MvolaOperation;
  /** MVola `errorCode`, e.g. "formatError". */
  readonly errorCode?: string;
  /** MVola `errorDescription`, e.g. "Missing field". */
  readonly errorDescription?: string;
  /** MVola `mmErrorCode` from `errorParameters`, e.g. "4001". */
  readonly mmErrorCode?: string;

  constructor(
    message: string,
    details: { status: number; operation: MvolaOperation; errorCode?: string; errorDescription?: string; mmErrorCode?: string },
  ) {
    super(message);
    this.name = "MvolaError";
    this.status = details.status;
    this.operation = details.operation;
    this.errorCode = details.errorCode;
    this.errorDescription = details.errorDescription;
    this.mmErrorCode = details.mmErrorCode;
  }
}

/** The request never got an HTTP answer (network failure or timeout). */
export class MvolaNetworkError extends Error {
  readonly operation: MvolaOperation;
  constructor(message: string, operation: MvolaOperation, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "MvolaNetworkError";
    this.operation = operation;
  }
}

/**
 * We cannot tell whether MVola accepted a money-moving request (timeout, network error, 5xx,
 * 408 or an unreadable answer after sending). The customer may have received the USSD prompt:
 * do NOT treat it as failed and do NOT blindly retry with a new reference. Keep the payment
 * pending and settle it from the callback or with `getStatus`.
 */
export class MvolaUncertainOutcomeError extends Error {
  readonly uncertain = true as const;
  readonly reference: string;
  constructor(message: string, reference: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "MvolaUncertainOutcomeError";
    this.reference = reference;
  }
}

/** The input was rejected locally; nothing was sent to MVola. */
export class MvolaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MvolaValidationError";
  }
}

export const isOutcomeUncertain = (error: unknown): error is MvolaUncertainOutcomeError => error instanceof MvolaUncertainOutcomeError;
