import { Auth } from "./auth";
import { MvolaValidationError } from "./errors";
import { Transaction } from "./transaction";
import { MvolaClientConfig } from "./types";

const SANDBOX_URL = "https://pre-api.mvola.mg";
const PRODUCTION_URL = "https://api.mvola.mg";

const required = (value: unknown, name: string): string => {
  if (typeof value !== "string" || value.trim() === "") throw new MvolaValidationError(`${name} is required`);
  return value;
};

export class MVolaClient {
  readonly transaction: Transaction;

  constructor(config: MvolaClientConfig) {
    const consumerKey = required(config?.consumerKey, "consumerKey");
    const consumerSecret = required(config.consumerSecret, "consumerSecret");
    const partnerName = required(config.partnerName, "partnerName");
    const merchantAccount = required(config.merchantAccount, "merchantAccount");

    let baseUrl = config.sandbox !== false ? SANDBOX_URL : PRODUCTION_URL;
    if (config.baseUrl !== undefined) {
      let url: URL;
      try {
        url = new URL(config.baseUrl);
      } catch {
        throw new MvolaValidationError("baseUrl is not a valid URL");
      }
      // The client sends credentials and tokens: never over plain http, never to a URL with embedded credentials.
      if (url.protocol !== "https:" || url.username || url.password) throw new MvolaValidationError("baseUrl must be an https URL without credentials");
      baseUrl = config.baseUrl.replace(/\/+$/, "");
    }
    const timeoutMs = config.timeoutMs ?? 20_000;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new MvolaValidationError("timeoutMs must be a positive number");

    const auth = new Auth(baseUrl, consumerKey, consumerSecret, timeoutMs);
    this.transaction = new Transaction(baseUrl, auth, { partnerName, merchantAccount, timeoutMs });
  }
}
