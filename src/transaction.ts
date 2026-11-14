import { randomUUID } from "node:crypto";
import { Auth } from "./auth";
import { MvolaError, MvolaNetworkError, MvolaOperation, MvolaUncertainOutcomeError, MvolaValidationError } from "./errors";
import { HttpInit, request } from "./http";
import { InitiateResult, InitiateTransactionParams, NormalizedStatus, TransactionDetails, TransactionResponse, TransactionStatus } from "./types";
import { assertAmount, assertCallbackUrl, assertId, assertReference, normalizeMsisdn, sanitizeDescription } from "./validation";

const PATH = "/mvola/mm/transactions/type/merchantpay/1.0.0";

/** Maps MVola's raw status ("completed" | "pending" | "failed", any case) to a closed set. */
export function normalizeStatus(raw: unknown): NormalizedStatus {
  const status = typeof raw === "string" ? raw.toLowerCase() : "";
  if (status === "completed" || status === "success") return "completed";
  if (status === "failed" || status === "rejected" || status === "cancelled") return "failed";
  if (status === "pending") return "pending";
  return "unknown";
}

export class Transaction {
  readonly #baseUrl: string;
  readonly #auth: Auth;
  readonly #partnerName: string;
  readonly #merchantAccount: string;
  readonly #timeoutMs: number;

  constructor(baseUrl: string, auth: Auth, options: { partnerName: string; merchantAccount: string; timeoutMs?: number }) {
    this.#baseUrl = baseUrl;
    this.#auth = auth;
    this.#partnerName = options.partnerName;
    this.#merchantAccount = options.merchantAccount;
    this.#timeoutMs = options.timeoutMs ?? 20_000;
  }

  /**
   * Authenticated call with a single retry on 401: MVola revokes the previous token whenever a
   * new one is issued (another instance, the developer portal...), so a cached token can be
   * rejected before its announced expiry. A 401 means nothing was processed, so replaying the
   * request once with a fresh token is safe, even for the money-moving POST.
   */
  async #authorized(url: string, init: HttpInit, operation: MvolaOperation): Promise<unknown> {
    const token = await this.#auth.getToken();
    try {
      return await request(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } }, this.#timeoutMs, operation);
    } catch (error) {
      if (!(error instanceof MvolaError) || error.status !== 401) throw error;
      const fresh = await this.#auth.getToken(token);
      return request(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${fresh}` } }, this.#timeoutMs, operation);
    }
  }

  async initiate(params: InitiateTransactionParams): Promise<InitiateResult> {
    // Everything is validated locally first: nothing reaches MVola if the input is wrong.
    assertAmount(params.amount);
    const currency = params.currency ?? "Ar";
    const description = sanitizeDescription(params.description);
    const debitParty = normalizeMsisdn(params.debitParty, "debitParty");
    const creditParty = normalizeMsisdn(params.creditParty, "creditParty");
    if (debitParty === creditParty) throw new MvolaValidationError("debitParty and creditParty must be different numbers");
    const reference = params.reference ?? randomUUID();
    assertReference(reference);
    if (params.callbackUrl !== undefined) assertCallbackUrl(params.callbackUrl);
    const partnerName = params.partnerName ?? this.#partnerName;

    const body = {
      amount: String(params.amount),
      currency,
      descriptionText: description,
      requestDate: new Date().toISOString(),
      debitParty: [{ key: "msisdn", value: debitParty }],
      creditParty: [{ key: "msisdn", value: creditParty }],
      // ORDER MATTERS: the gateway reads the metadata by position, in the order of the API guide.
      metadata: [
        { key: "partnerName", value: partnerName },
        { key: "fc", value: params.fc ?? "USD" },
        { key: "amountFc", value: params.amountFc ?? "1" },
      ],
      requestingOrganisationTransactionReference: reference,
      originalTransactionReference: reference,
    };

    const headers: Record<string, string> = {
      Version: "1.0",
      "X-CorrelationID": reference,
      UserLanguage: params.language ?? "FR",
      UserAccountIdentifier: `msisdn;${debitParty}`,
      partnerName,
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    };
    if (params.callbackUrl) headers["X-Callback-URL"] = params.callbackUrl;

    let data: unknown;
    try {
      data = await this.#authorized(`${this.#baseUrl}${PATH}/`, { method: "POST", headers, body: JSON.stringify(body) }, "initiate");
    } catch (error) {
      // A definite refusal (4xx other than a timeout) means nothing was initiated: surface it as is.
      if (error instanceof MvolaError && error.status >= 400 && error.status < 500 && error.status !== 408) throw error;
      if (error instanceof MvolaError || error instanceof MvolaNetworkError) {
        throw new MvolaUncertainOutcomeError(`MVola outcome unknown for reference ${reference}: ${error.message}`, reference, { cause: error });
      }
      throw error;
    }

    const result = data as Partial<TransactionResponse> | undefined;
    if (!result || typeof result.serverCorrelationId !== "string") {
      throw new MvolaUncertainOutcomeError(`MVola answered without a serverCorrelationId for reference ${reference}`, reference);
    }
    return { status: String(result.status), serverCorrelationId: result.serverCorrelationId, notificationMethod: String(result.notificationMethod), reference };
  }

  async getStatus(serverCorrelationId: string): Promise<TransactionStatus> {
    assertId(serverCorrelationId, "serverCorrelationId");
    return (await this.#authorized(`${this.#baseUrl}${PATH}/status/${encodeURIComponent(serverCorrelationId)}`, { method: "GET", headers: this.#readHeaders() }, "status")) as TransactionStatus;
  }

  async getDetails(transactionId: string): Promise<TransactionDetails> {
    assertId(transactionId, "transactionId");
    return (await this.#authorized(`${this.#baseUrl}${PATH}/${encodeURIComponent(transactionId)}`, { method: "GET", headers: this.#readHeaders() }, "details")) as TransactionDetails;
  }

  #readHeaders(): Record<string, string> {
    return {
      Version: "1.0",
      "X-CorrelationID": randomUUID(),
      UserAccountIdentifier: `msisdn;${this.#merchantAccount}`,
      partnerName: this.#partnerName,
      "Cache-Control": "no-cache",
    };
  }
}
