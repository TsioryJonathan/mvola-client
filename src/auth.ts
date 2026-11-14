import { MvolaError } from "./errors";
import { request } from "./http";
import { TokenResponse } from "./types";

const EXPIRY_MARGIN_MS = 30_000;

/**
 * OAuth2 client-credentials token provider.
 *
 * A cached token can be rejected before its announced expiry (revoked keys, a token issued
 * elsewhere...). Hence, defensively:
 *  - one in-flight /token request at a time, shared by all callers (no token storm);
 *  - `getToken(rejected)` lets a caller that got a 401 ask for a fresh token WITHOUT discarding a
 *    token another caller has just obtained.
 * The credentials live in private fields: they never appear in logs, errors or JSON dumps.
 */
export class Auth {
  readonly #baseUrl: string;
  readonly #basic: string;
  readonly #timeoutMs: number;
  readonly #secrets: string[];
  #cache: { token: string; expiresAt: number } | null = null;
  #inFlight: Promise<string> | null = null;

  constructor(baseUrl: string, consumerKey: string, consumerSecret: string, timeoutMs = 20_000) {
    this.#baseUrl = baseUrl;
    this.#basic = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
    this.#timeoutMs = timeoutMs;
    this.#secrets = [consumerKey, consumerSecret, this.#basic].filter((value) => value.length > 0);
  }

  /** MVola echoes the client_id in its OAuth errors: never let a credential reach an error message. */
  #redact(text: string | undefined): string | undefined {
    if (text === undefined) return text;
    return this.#secrets.reduce((clean, secret) => clean.split(secret).join("[redacted]"), text);
  }

  async getToken(rejectedToken?: string): Promise<string> {
    if (rejectedToken && this.#cache?.token === rejectedToken) this.#cache = null;
    if (this.#cache && this.#cache.expiresAt > Date.now() + EXPIRY_MARGIN_MS) return this.#cache.token;
    if (this.#inFlight) return this.#inFlight;

    const requestedAt = Date.now();
    const pending = (async () => {
      let raw: unknown;
      try {
        raw = await request(
            `${this.#baseUrl}/token`,
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${this.#basic}`,
                "Content-Type": "application/x-www-form-urlencoded",
                "Cache-Control": "no-cache",
              },
              body: "grant_type=client_credentials&scope=EXT_INT_MVOLA_SCOPE",
            },
            this.#timeoutMs,
            "authentication",
        );
      } catch (error) {
        if (!(error instanceof MvolaError)) throw error;
        throw new MvolaError(this.#redact(error.message) as string, {
          status: error.status,
          operation: error.operation,
          errorCode: this.#redact(error.errorCode),
          errorDescription: this.#redact(error.errorDescription),
          mmErrorCode: error.mmErrorCode,
        });
      }
      const data = raw as Partial<TokenResponse> | undefined;

      if (!data || typeof data.access_token !== "string" || !data.access_token || typeof data.expires_in !== "number") {
        throw new MvolaError("MVola authentication failed: malformed token response", { status: 200, operation: "authentication" });
      }
      this.#cache = { token: data.access_token, expiresAt: requestedAt + data.expires_in * 1000 };
      return data.access_token;
    })();

    this.#inFlight = pending;
    try {
      return await pending;
    } finally {
      if (this.#inFlight === pending) this.#inFlight = null;
    }
  }
}
