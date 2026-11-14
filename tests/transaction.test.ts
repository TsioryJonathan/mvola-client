import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Auth } from "../src/auth";
import { MvolaError, MvolaUncertainOutcomeError, MvolaValidationError, isOutcomeUncertain } from "../src/errors";
import { Transaction, normalizeStatus } from "../src/transaction";
import { invalidJwt, json, missingField, mockFetch, pendingResponse, tokenCalls, tokenResponse } from "./helpers";

const BASE = "https://pre-api.mvola.mg";
const PARAMS = { amount: 10000, description: "Test payment", debitParty: "0343500004", creditParty: "0343500003" };

describe("Transaction", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let transaction: Transaction;

  beforeEach(() => {
    fetchMock = mockFetch();
    transaction = new Transaction(BASE, new Auth(BASE, "key", "secret"), { partnerName: "Acme", merchantAccount: "0343500003", timeoutMs: 200 });
  });
  afterEach(() => vi.unstubAllGlobals());

  const sentRequest = (index = 1) => {
    const [url, init] = fetchMock.mock.calls[index];
    return { url: String(url), headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(init.body) : undefined, init };
  };

  describe("initiate", () => {
    it("sends the documented request and returns the reference it used", async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse("tok")).mockResolvedValueOnce(pendingResponse("corr-9"));
      const result = await transaction.initiate({ ...PARAMS, reference: "order-42", callbackUrl: "https://api.example.com/hook?ref=order-42.sig" });

      expect(result).toEqual({ status: "pending", serverCorrelationId: "corr-9", notificationMethod: "callback", reference: "order-42" });
      const { url, headers, body, init } = sentRequest();
      expect(url).toBe(`${BASE}/mvola/mm/transactions/type/merchantpay/1.0.0/`);
      expect(init.method).toBe("POST");
      expect(headers).toMatchObject({
        Authorization: "Bearer tok",
        Version: "1.0",
        "X-CorrelationID": "order-42",
        UserLanguage: "FR",
        UserAccountIdentifier: "msisdn;0343500004",
        partnerName: "Acme",
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Callback-URL": "https://api.example.com/hook?ref=order-42.sig",
      });
      expect(body).toMatchObject({
        amount: "10000",
        currency: "Ar",
        descriptionText: "Test payment",
        debitParty: [{ key: "msisdn", value: "0343500004" }],
        creditParty: [{ key: "msisdn", value: "0343500003" }],
        requestingOrganisationTransactionReference: "order-42",
        originalTransactionReference: "order-42",
      });
      expect(body.requestDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("sends the metadata in the order of the API guide: partnerName, fc, amountFc", async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(pendingResponse());
      await transaction.initiate({ ...PARAMS, fc: "Ar", amountFc: "10000" });
      expect(sentRequest().body.metadata).toEqual([
        { key: "partnerName", value: "Acme" },
        { key: "fc", value: "Ar" },
        { key: "amountFc", value: "10000" },
      ]);
    });

    it("generates a UUID reference by default and omits X-Callback-URL when there is none", async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(pendingResponse());
      const result = await transaction.initiate(PARAMS);
      expect(result.reference).toMatch(/^[0-9a-f-]{36}$/);
      expect(sentRequest().headers).not.toHaveProperty("X-Callback-URL");
      expect(Object.values(sentRequest().headers)).not.toContain("");
    });

    it("validates locally: nothing is sent for bad input", async () => {
      const bad: Array<Parameters<Transaction["initiate"]>[0]> = [
        { ...PARAMS, amount: 10.5 },
        { ...PARAMS, amount: 0 },
        { ...PARAMS, debitParty: "123" },
        { ...PARAMS, creditParty: PARAMS.debitParty },
        { ...PARAMS, reference: "bad/ref" },
        { ...PARAMS, description: "###" },
        { ...PARAMS, callbackUrl: "https://api.example.com/hook?ref=a&sig=b" },
        { ...PARAMS, callbackUrl: "http://api.example.com/hook" },
      ];
      for (const params of bad) await expect(transaction.initiate(params)).rejects.toBeInstanceOf(MvolaValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("a definite 4xx refusal surfaces MVola's error fields", async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(missingField());
      const error = await transaction.initiate(PARAMS).catch((e) => e);
      expect(error).toBeInstanceOf(MvolaError);
      expect(isOutcomeUncertain(error)).toBe(false);
      expect(error).toMatchObject({ status: 400, operation: "initiate", errorCode: "formatError", errorDescription: "Missing field", mmErrorCode: "4001" });
    });

    it("a 5xx, a timeout or an unreadable answer is an UNCERTAIN outcome, never a plain failure", async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(json({ errorDescription: "Error in getting user language" }, 500));
      const e500 = await transaction.initiate({ ...PARAMS, reference: "r-500" }).catch((e) => e);
      expect(e500).toBeInstanceOf(MvolaUncertainOutcomeError);
      expect(e500.reference).toBe("r-500");

      fetchMock.mockReset();
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockImplementationOnce((_url: string, init: { signal: AbortSignal }) => new Promise((_res, rej) => init.signal.addEventListener("abort", () => rej(init.signal.reason))));
      const timeout = await transaction.initiate({ ...PARAMS, reference: "r-timeout" }).catch((e) => e);
      expect(isOutcomeUncertain(timeout)).toBe(true);

      fetchMock.mockReset();
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(json({ unexpected: true }, 202));
      const malformed = await transaction.initiate({ ...PARAMS, reference: "r-bad" }).catch((e) => e);
      expect(isOutcomeUncertain(malformed)).toBe(true);
    });

    it("on 401 refreshes once and replays the request", async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse("old"))
        .mockResolvedValueOnce(invalidJwt())
        .mockResolvedValueOnce(tokenResponse("fresh"))
        .mockResolvedValueOnce(pendingResponse("corr-ok"));
      const result = await transaction.initiate({ ...PARAMS, reference: "r-401" });
      expect(result.serverCorrelationId).toBe("corr-ok");
      expect(sentRequest(1).headers.Authorization).toBe("Bearer old");
      expect(sentRequest(3).headers.Authorization).toBe("Bearer fresh");
      expect(sentRequest(3).body.requestingOrganisationTransactionReference).toBe("r-401");
    });

    it("a second 401 is propagated: no loop", async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse("old")).mockResolvedValueOnce(invalidJwt()).mockResolvedValueOnce(tokenResponse("fresh")).mockResolvedValueOnce(invalidJwt());
      await expect(transaction.initiate(PARAMS)).rejects.toMatchObject({ status: 401 });
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("concurrent initiations share one /token request", async () => {
      fetchMock.mockImplementation(async (url: string) => (String(url).endsWith("/token") ? tokenResponse("shared") : pendingResponse()));
      await Promise.all([transaction.initiate(PARAMS), transaction.initiate(PARAMS), transaction.initiate(PARAMS)]);
      expect(tokenCalls(fetchMock)).toHaveLength(1);
    });
  });

  describe("getStatus / getDetails", () => {
    it("getStatus calls the status endpoint with the merchant account", async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(json({ status: "completed", serverCorrelationId: "c", notificationMethod: "callback", objectReference: "o" }));
      const status = await transaction.getStatus("corr-1");
      expect(status.status).toBe("completed");
      const { url, headers, init } = sentRequest();
      expect(url).toBe(`${BASE}/mvola/mm/transactions/type/merchantpay/1.0.0/status/corr-1`);
      expect(init.method).toBe("GET");
      expect(headers).toMatchObject({ UserAccountIdentifier: "msisdn;0343500003", partnerName: "Acme", Authorization: "Bearer token-1" });
    });

    it("path parameters are URL-encoded: no path injection", async () => {
      fetchMock.mockResolvedValue(tokenResponse()).mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(json({}));
      await transaction.getStatus("../../admin?x=1");
      expect(sentRequest().url).toBe(`${BASE}/mvola/mm/transactions/type/merchantpay/1.0.0/status/..%2F..%2Fadmin%3Fx%3D1`);
    });

    it("getDetails calls the details endpoint and rejects empty ids locally", async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(json({ amount: "1000", currency: "Ar" }));
      expect((await transaction.getDetails("12345")).amount).toBe("1000");
      expect(sentRequest().url).toBe(`${BASE}/mvola/mm/transactions/type/merchantpay/1.0.0/12345`);
      await expect(transaction.getDetails("")).rejects.toBeInstanceOf(MvolaValidationError);
      await expect(transaction.getStatus("x".repeat(101))).rejects.toBeInstanceOf(MvolaValidationError);
    });

    it("errors carry the operation", async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(json({ errorDescription: "nope" }, 404));
      await expect(transaction.getStatus("missing")).rejects.toMatchObject({ status: 404, operation: "status" });
    });
  });

  it("normalizeStatus maps MVola statuses to a closed set", () => {
    expect(normalizeStatus("Completed")).toBe("completed");
    expect(normalizeStatus("pending")).toBe("pending");
    expect(normalizeStatus("FAILED")).toBe("failed");
    expect(normalizeStatus(undefined)).toBe("unknown");
    expect(normalizeStatus("weird")).toBe("unknown");
  });
});
