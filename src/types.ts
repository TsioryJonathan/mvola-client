export interface MvolaClientConfig {
  consumerKey: string;
  consumerSecret: string;
  /** Sandbox by default (safe default); pass `false` for production. */
  sandbox?: boolean;
  /** Overrides the API host (https only), e.g. if MVola moves it again. */
  baseUrl?: string;
  /** Default partner name sent in headers and metadata (the name of your company). */
  partnerName: string;
  /** Your merchant MSISDN, used by getStatus / getDetails. */
  merchantAccount: string;
  /** Per-request timeout in milliseconds (default 20000). */
  timeoutMs?: number;
}

export type TokenResponse = {
  access_token: string;
  scope: string;
  token_type: string;
  expires_in: number;
};

export type TransactionParty = {
  key: "msisdn";
  value: string;
};

export type TransactionMetadata = {
  key: string;
  value: string;
};

export interface InitiateTransactionParams {
  /** Positive integer, in Ariary (no decimals). */
  amount: number;
  currency?: string;
  /** At most 50 characters; special characters other than "- . _ ," are replaced by spaces. */
  description: string;
  /** Subscriber being debited. Must differ from `creditParty`. */
  debitParty: string;
  /** Merchant being credited. */
  creditParty: string;
  /** Defaults to the `partnerName` of the client config. */
  partnerName?: string;
  /**
   * Your own transaction reference (1-50 chars, no special characters except "- . _ ,").
   * Defaults to a random UUID. Use it to make a retry idempotent on your side.
   */
  reference?: string;
  fc?: string;
  amountFc?: string;
  /** https URL with AT MOST ONE query parameter (MVola rejects more, see README). */
  callbackUrl?: string;
  language?: "FR" | "MG";
}

export type TransactionResponse = {
  status: string;
  serverCorrelationId: string;
  notificationMethod: string;
};

/** What `initiate` returns: MVola's answer plus the reference that was sent. */
export type InitiateResult = TransactionResponse & { reference: string };

export type TransactionStatus = {
  status: string;
  serverCorrelationId: string;
  notificationMethod: string;
  objectReference: string;
};

export type TransactionDetails = {
  amount: string;
  currency: string;
  transactionReference: string;
  transactionStatus: string;
  createDate: string;
  requestDate: string;
  debitParty: TransactionParty[];
  creditParty: TransactionParty[];
  metadata: TransactionMetadata[];
  fees: { feeAmount: string }[];
};

export type NormalizedStatus = "completed" | "pending" | "failed" | "unknown";
