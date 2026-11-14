# mvola-client

MVola **Merchant Pay** client for Node.js — native `fetch`, zero runtime dependencies. Works with `require` and `import` (Node >= 18).

```sh
npm install mvola-client
```

## Usage

```ts
import { MVolaClient } from "mvola-client";

const client = new MVolaClient({
  consumerKey: process.env.MVOLA_CONSUMER_KEY!,
  consumerSecret: process.env.MVOLA_CONSUMER_SECRET!,
  partnerName: "MyCompany",
  merchantAccount: "0343500003",
  // sandbox: true is the default; pass false for production
});

const tx = await client.transaction.initiate({
  amount: 10000, // integer, Ariary
  description: "Order 42",
  debitParty: "0343500004", // the customer who pays
  creditParty: "0343500003", // your merchant account
  reference: "order-42", // optional: your own id, makes retries idempotent
  callbackUrl: "https://api.example.com/webhook?ref=order-42", // optional
});

const status = await client.transaction.getStatus(tx.serverCorrelationId);
const details = await client.transaction.getDetails(status.objectReference);
```

`initiate` returns `{ status, serverCorrelationId, notificationMethod, reference }`.
Other options: `baseUrl` (https only), `timeoutMs` (default 20000), `currency`, `language`, `fc` / `amountFc`.

## Good to know

- **Metadata order matters.** The gateway reads it by position; the client sends `partnerName`, `fc`, `amountFc` first. Any other order fails with `400 Missing field` (4001).
- **Sandbox:** only the test numbers `0343500003` and `0343500004` work.
- **On `401`** the client fetches a fresh token and retries once.

## Errors

| Error | Meaning |
|---|---|
| `MvolaValidationError` | Bad input, nothing was sent |
| `MvolaError` | MVola answered with an HTTP error (`status`, `errorCode`, `errorDescription`, `mmErrorCode`). A 4xx on `initiate` is a definite refusal |
| `MvolaUncertainOutcomeError` | Timeout, network error, 5xx or unreadable answer on `initiate`: **the payment may have been accepted**. Don't treat it as failed and don't retry with a new reference; settle it with the callback or `getStatus` |
| `MvolaNetworkError` | No answer on `getStatus` / `getDetails` / authentication |

```ts
import { isOutcomeUncertain, normalizeStatus } from "mvola-client";

try {
  await client.transaction.initiate({ /* ... */ });
} catch (error) {
  if (isOutcomeUncertain(error)) {
    // keep error.reference pending
  } else throw error;
}

normalizeStatus(status.status); // "completed" | "pending" | "failed" | "unknown"
```

MVola does not sign its callbacks: sign your callback URL, and confirm the verdict with `getStatus` before crediting anything.

Credentials are kept in private fields and never appear in errors or JSON dumps.

## License

MIT
