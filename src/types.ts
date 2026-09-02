export interface MvolaClientConfig {
  consumerKey: string;
  consumerSecret: string;
  sandbox?: boolean;
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
  amount: number;
  currency?: string;
  description: string;
  debitParty: string;
  creditParty: string;
  partnerName: string;
  fc?: string;
  amountFc?: string;
  callbackUrl?: string;
  language?: "FR" | "MG";
  metadata?: TransactionMetadata[];
}

export type TransactionResponse = {
  status: string;
  serverCorrelationId: string;
  notificationMethod: string;
};

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
