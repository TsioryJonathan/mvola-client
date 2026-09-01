import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Transaction } from "../src/transaction";
import { Auth } from "../src/auth";

describe("Transaction", () => {
  let transaction: Transaction;
  let auth: Auth;
  const mockFetch = vi.fn();

  const tokenResponse = {
    ok: true,
    json: async () => ({
      access_token: "test-token",
      expires_in: 3600,
    }),
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    vi.stubGlobal("crypto", {
      randomUUID: () => "test-uuid-1234",
    });
    auth = new Auth("https://pre-api.mvola.mg", "test-key", "test-secret");
    transaction = new Transaction(
      "https://pre-api.mvola.mg",
      auth,
      "0343500003"
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should initiate transaction", async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "pending",
          serverCorrelationId: "test-correlation-id",
          notificationMethod: "callback",
        }),
      });

    const result = await transaction.initiate({
      amount: 10000,
      description: "Test payment",
      debitParty: "0343500003",
      creditParty: "0343500004",
      partnerName: "TestPartner",
    });

    expect(result.status).toBe("pending");
    expect(result.serverCorrelationId).toBeDefined();
  });

  it("should get transaction status", async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "completed",
          serverCorrelationId: "test-correlation-id",
          notificationMethod: "polling",
          objectReference: "123456",
        }),
      });

    const result = await transaction.getStatus("test-correlation-id");
    expect(result.status).toBe("completed");
  });

  it("should get transaction details", async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          amount: "10000.00",
          currency: "Ar",
          transactionReference: "123456",
          transactionStatus: "completed",
          createDate: "2024-01-01T00:00:00Z",
          requestDate: "2024-01-01T00:00:00Z",
          debitParty: [{ key: "msisdn", value: "0343500003" }],
          creditParty: [{ key: "msisdn", value: "0343500004" }],
          metadata: [],
          fees: [],
        }),
      });

    const result = await transaction.getDetails("123456");
    expect(result.amount).toBe("10000.00");
  });
});
