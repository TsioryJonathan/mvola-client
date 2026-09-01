import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Auth } from "../src/auth";

describe("Auth", () => {
  let auth: Auth;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    auth = new Auth("https://pre-api.mvola.mg", "test-key", "test-secret");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return access token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "test-token",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "EXT_INT_MVOLA_SCOPE",
      }),
    });

    const token = await auth.getToken();
    expect(token).toBe("test-token");
  });

  it("should cache token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "cached-token",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "EXT_INT_MVOLA_SCOPE",
      }),
    });

    await auth.getToken();
    await auth.getToken();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should throw on auth failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    await expect(auth.getToken()).rejects.toThrow("MVola auth failed 401");
  });
});
