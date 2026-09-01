import { TokenResponse } from "./types";

export class Auth {
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(
    private baseUrl: string,
    private consumerKey: string,
    private consumerSecret: string
  ) {}

  async getToken(): Promise<string> {
    const now = Date.now();

    if (this.tokenCache && this.tokenCache.expiresAt > now + 30_000) {
      return this.tokenCache.token;
    }

    const basic = btoa(`${this.consumerKey}:${this.consumerSecret}`);

    const response = await fetch(`${this.baseUrl}/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=EXT_INT_MVOLA_SCOPE",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`MVola auth failed ${response.status}: ${body}`);
    }

    const data: TokenResponse = await response.json();

    this.tokenCache = {
      token: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    };

    return data.access_token;
  }
}
