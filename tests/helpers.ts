import { vi } from "vitest";

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
export const tokenResponse = (token = "token-1") => json({ access_token: token, scope: "EXT_INT_MVOLA_SCOPE", token_type: "Bearer", expires_in: 3600 });
export const pendingResponse = (id = "corr-1") => json({ status: "pending", serverCorrelationId: id, notificationMethod: "callback" }, 202);
export const invalidJwt = () => json({ fault: { code: 900901, message: "Invalid Credentials", description: "Invalid JWT token." } }, 401);
export const missingField = () =>
  json({ errorCategory: "validation", errorCode: "formatError", errorDescription: "Missing field", errorParameters: [{ key: "mmErrorCode", value: "4001" }] }, 400);

export const mockFetch = () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

export const tokenCalls = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/token"));
