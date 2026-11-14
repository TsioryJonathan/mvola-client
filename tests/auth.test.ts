import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Auth } from "../src/auth";
import { MvolaError, MvolaNetworkError } from "../src/errors";
import { json, mockFetch, tokenCalls, tokenResponse } from "./helpers";

const BASE = "https://pre-api.mvola.mg";

describe("Auth", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = mockFetch();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("requests a token with Basic credentials and caches it", async () => {
    fetchMock.mockImplementation(async () => tokenResponse("t1"));
    const auth = new Auth(BASE, "key", "secret");
    expect(await auth.getToken()).toBe("t1");
    expect(await auth.getToken()).toBe("t1");
    expect(tokenCalls(fetchMock)).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/token`);
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("key:secret").toString("base64")}`);
    expect(init.body).toBe("grant_type=client_credentials&scope=EXT_INT_MVOLA_SCOPE");
  });

  it("shares one /token request between concurrent callers", async () => {
    fetchMock.mockImplementation(async () => tokenResponse("shared"));
    const auth = new Auth(BASE, "key", "secret");
    const tokens = await Promise.all([auth.getToken(), auth.getToken(), auth.getToken()]);
    expect(tokens).toEqual(["shared", "shared", "shared"]);
    expect(tokenCalls(fetchMock)).toHaveLength(1);
  });

  it("a rejected token is replaced, but a token someone else just refreshed is kept", async () => {
    fetchMock.mockImplementationOnce(async () => tokenResponse("old")).mockImplementationOnce(async () => tokenResponse("fresh"));
    const auth = new Auth(BASE, "key", "secret");
    const old = await auth.getToken();
    expect(await auth.getToken(old)).toBe("fresh");
    // Another caller still holding "old" asks for a refresh: it must get "fresh", not trigger a third token.
    expect(await auth.getToken(old)).toBe("fresh");
    expect(tokenCalls(fetchMock)).toHaveLength(2);
  });

  it("types a refused authentication and never leaks the credentials", async () => {
    fetchMock.mockImplementation(async () => json({ error: "invalid_client" }, 401));
    const auth = new Auth(BASE, "my-key", "my-secret");
    const error = await auth.getToken().catch((e) => e);
    expect(error).toBeInstanceOf(MvolaError);
    expect(error.status).toBe(401);
    expect(error.operation).toBe("authentication");
    const dump = `${error.message} ${JSON.stringify(error)} ${error.stack}`;
    expect(dump).not.toContain("my-key");
    expect(dump).not.toContain("my-secret");
    expect(dump).not.toContain(Buffer.from("my-key:my-secret").toString("base64"));
  });

  it("redacts the credentials MVola echoes back in its OAuth error", async () => {
    fetchMock.mockImplementation(async () =>
      json({ error_description: "A valid OAuth client could not be found for client_id: my-key (secret my-secret)", error: "invalid_client" }, 401),
    );
    const error = await new Auth(BASE, "my-key", "my-secret").getToken().catch((e) => e);
    expect(error).toBeInstanceOf(MvolaError);
    expect(error).toMatchObject({ status: 401, operation: "authentication" });
    expect(error.message).toContain("[redacted]");
    expect(`${error.message} ${error.stack}`).not.toMatch(/my-key|my-secret/);
  });

  it("rejects a malformed token response", async () => {
    fetchMock.mockImplementation(async () => json({ nope: true }));
    await expect(new Auth(BASE, "k", "s").getToken()).rejects.toBeInstanceOf(MvolaError);
  });

  it("times out instead of hanging", async () => {
    fetchMock.mockImplementation((_url: string, init: { signal: AbortSignal }) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason))));
    await expect(new Auth(BASE, "k", "s", 30).getToken()).rejects.toBeInstanceOf(MvolaNetworkError);
  });
});
