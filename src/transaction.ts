import { Auth } from "./auth";
import {
  InitiateTransactionParams,
  TransactionResponse,
  TransactionStatus,
  TransactionDetails,
} from "./types";

export class Transaction {
  private auth: Auth;
  private baseUrl: string;
  private merchantAccount: string;

  constructor(baseUrl: string, auth: Auth, merchantAccount: string) {
    this.baseUrl = baseUrl;
    this.auth = auth;
    this.merchantAccount = merchantAccount;
  }

  async initiate(params: InitiateTransactionParams): Promise<TransactionResponse> {
    const token = await this.auth.getToken();
    const correlationId = crypto.randomUUID();
    const externalRef = correlationId;

    const body = {
      amount: String(params.amount),
      currency: params.currency ?? "Ar",
      descriptionText: params.description,
      requestDate: new Date().toISOString(),
      debitParty: [{ key: "msisdn", value: params.debitParty }],
      creditParty: [{ key: "msisdn", value: params.creditParty }],
      metadata: [
        { key: "partnerName", value: params.partnerName },
        { key: "fc", value: params.fc ?? "USD" },
        { key: "amountFc", value: params.amountFc ?? "1" },
        ...(params.metadata ?? []),
      ],
      requestingOrganisationTransactionReference: externalRef,
      originalTransactionReference: externalRef,
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Version: "1.0",
      "X-CorrelationID": correlationId,
      UserLanguage: params.language ?? "FR",
      "UserAccountIdentifier": `msisdn;${params.debitParty}`,
      partnerName: params.partnerName,
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    };

    if (params.callbackUrl) {
      headers["X-Callback-URL"] = params.callbackUrl;
    }

    const response = await fetch(
      `${this.baseUrl}/mvola/mm/transactions/type/merchantpay/1.0.0/`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MVola initiate failed ${response.status}: ${error}`);
    }

    return (await response.json()) as TransactionResponse;
  }

  async getStatus(serverCorrelationId: string): Promise<TransactionStatus> {
    const token = await this.auth.getToken();

    const response = await fetch(
      `${this.baseUrl}/mvola/mm/transactions/type/merchantpay/1.0.0/status/${serverCorrelationId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Version: "1.0",
          "X-CorrelationID": crypto.randomUUID(),
          "UserAccountIdentifier": `msisdn;${this.merchantAccount}`,
          partnerName: "Deepoz",
          "Cache-Control": "no-cache",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MVola status failed ${response.status}: ${error}`);
    }

    return (await response.json()) as TransactionStatus;
  }

  async getDetails(transactionId: string): Promise<TransactionDetails> {
    const token = await this.auth.getToken();

    const response = await fetch(
      `${this.baseUrl}/mvola/mm/transactions/type/merchantpay/1.0.0/${transactionId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Version: "1.0",
          "X-CorrelationID": crypto.randomUUID(),
          "UserAccountIdentifier": `msisdn;${this.merchantAccount}`,
          partnerName: "Deepoz",
          "Cache-Control": "no-cache",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MVola details failed ${response.status}: ${error}`);
    }

    return (await response.json()) as TransactionDetails;
  }
}
