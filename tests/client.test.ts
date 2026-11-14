import { afterEach, describe, expect, it, vi } from "vitest";
import { MVolaClient, MvolaValidationError } from "../src";
import { mockFetch, pendingResponse, tokenResponse } from "./helpers";

const CONFIG = { consumerKey: "k", consumerSecret: "s", partnerName: "Acme", merchantAccount: "0343500003" };

describe("MVolaClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requires its configuration", () => {
    for (const missing of ["consumerKey", "consumerSecret", "partnerName", "merchantAccount"]) {
      expect(() => new MVolaClient({ ...CONFIG, [missing]: "" })).toThrow(MvolaValidationError);
    }
  });

  it("uses the sandbox by default and production only when asked", async () => {
    const fetchMock = mockFetch();
    fetchMock.mockImplementation(async (url: string) => (String(url).endsWith("/token") ? tokenResponse() : pendingResponse()));
    const params = { amount: 1000, description: "x", debitParty: "0343500004", creditParty: "0343500003" };

    await new MVolaClient(CONFIG).transaction.initiate(params);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://pre-api.mvola.mg/token");

    fetchMock.mockClear();
    await new MVolaClient({ ...CONFIG, sandbox: false }).transaction.initiate(params);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.mvola.mg/token");
  });

  it("baseUrl override must be https without credentials (tokens and keys travel there)", () => {
    expect(() => new MVolaClient({ ...CONFIG, baseUrl: "http://evil.example.com" })).toThrow(MvolaValidationError);
    expect(() => new MVolaClient({ ...CONFIG, baseUrl: "https://user:pw@evil.example.com" })).toThrow(MvolaValidationError);
    expect(() => new MVolaClient({ ...CONFIG, baseUrl: "nope" })).toThrow(MvolaValidationError);
    expect(() => new MVolaClient({ ...CONFIG, baseUrl: "https://devapi.mvola.mg/" })).not.toThrow();
  });

  it("does not expose the credentials when the client is logged or serialised", () => {
    const client = new MVolaClient({ ...CONFIG, consumerKey: "super-key", consumerSecret: "super-secret" });
    const dump = JSON.stringify(client) + JSON.stringify(client.transaction) + String(Object.keys(client.transaction));
    expect(dump).not.toContain("super-key");
    expect(dump).not.toContain("super-secret");
    expect(dump).not.toContain(Buffer.from("super-key:super-secret").toString("base64"));
  });
});
