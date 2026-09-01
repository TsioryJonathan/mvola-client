import { Auth } from "./auth";
import { Transaction } from "./transaction";
import { MvolaClientConfig } from "./types";

const SANDBOX_URL = "https://pre-api.mvola.mg";
const PRODUCTION_URL = "https://api.mvola.mg";

export class MVolaClient {
  readonly transaction: Transaction;
  private auth: Auth;

  constructor(config: MvolaClientConfig) {
    const baseUrl = config.sandbox !== false ? SANDBOX_URL : PRODUCTION_URL;
    this.auth = new Auth(baseUrl, config.consumerKey, config.consumerSecret);
    this.transaction = new Transaction(
      baseUrl,
      this.auth,
      config.sandbox !== false ? "Deepoz" : "Deepoz",
      "0343500003"
    );
  }
}
