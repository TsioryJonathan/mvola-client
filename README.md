# mvola-client

MVola **Merchant Pay** client for Node.js — native `fetch`, zero runtime dependencies, safe by default.

- Works with `require` and `import` (Node >= 18)
- Typed errors, with an explicit **"outcome unknown"** error for money-moving calls
- One shared token request (MVola revokes the previous token whenever a new one is issued)
- Every request is bounded by a timeout, every input is validated before anything is sent
- Credentials are never logged, serialised or put in error messages

## Install

```sh
npm install mvola-client
```

## Quick start

```ts
import { MVolaClient } from "mvola-client";

const client = new MVolaClient({
  consumerKey: process.env.MVOLA_CONSUMER_KEY!,
  consumerSecret: process.env.MVOLA_CONSUMER_SECRET!,
  sandbox: true, // default; use false for production
  partnerName: "MyCompany",
  merchantAccount: "0343500003",
});

const tx = await client.transaction.initiate({
  amount: 10000,
  description: "Order 42",
  debitParty: "0343500004", // the customer who pays
  creditParty: "0343500003", // your merchant account
  reference: "order-42", // optional, your own idempotent reference
  callbackUrl: "https://api.example.com/webhook?ref=order-42.<signature>",
});

console.log(tx.serverCorrelationId, tx.reference);
```

## Things MVola does not tell you (all verified against the sandbox)

1. **Metadata order matters.** The gateway reads the metadata by position. The client always sends
   `partnerName`, `fc`, `amountFc` first, in that order. Sending anything before them fails with
   `400 Missing field (mmErrorCode 4001)`.
2. **The callback URL may have only ONE query parameter.** `?ref=a&sig=b` is rejected with the same
   `400 Missing field`, even with a 3-character signature. The client throws a `MvolaValidationError`
   before sending. Carry everything in one parameter, e.g. `?ref=<id>.<hmac>`.
3. **The token is revoked when a new one is issued.** Two processes sharing the same keys (or the
   developer portal's "Try out") invalidate each other and the next call answers `401 Invalid JWT token`.
   The client shares one `/token` request between concurrent calls and retries once on `401` with a fresh
   token (safe: a `401` means nothing was processed). Across several instances you still get one retry
   per conflict, so avoid sharing keys between environments.
4. **The sandbox is flaky.** You may see `500 Error in getting user language` (mmErrorCode 4002), or a
   request accepted with `202` that fails a second later without a transaction reference. It is
   intermittent and not caused by the payload.
5. **Sandbox accepts only the test numbers** `0343500003` and `0343500004`; approve transactions in the
   portal's *Transaction Approvals*.

## Errors

| Error | Meaning | What to do |
|---|---|---|
| `MvolaValidationError` | The input was rejected locally; nothing was sent | Fix the input |
| `MvolaError` | MVola answered with an HTTP error (`status`, `operation`, `errorCode`, `errorDescription`, `mmErrorCode`) | A 4xx on `initiate` is a definite refusal: nothing was initiated |
| `MvolaUncertainOutcomeError` | We cannot tell if MVola accepted the payment (timeout, network, 5xx, 408, unreadable answer) | **Do not treat it as failed and do not retry with a new reference.** Keep it pending and settle it from the callback or `getStatus` |
| `MvolaNetworkError` | No HTTP answer on `getStatus` / `getDetails` / authentication | Retry later |

```ts
import { isOutcomeUncertain } from "mvola-client";

try {
  await client.transaction.initiate({ /* ... */ reference });
} catch (error) {
  if (isOutcomeUncertain(error)) {
    // the customer may have received the USSD prompt: keep `error.reference` pending
  } else throw error;
}
```

## Settling a payment

```ts
import { normalizeStatus } from "mvola-client";

const status = await client.transaction.getStatus(serverCorrelationId);
normalizeStatus(status.status); // "completed" | "pending" | "failed" | "unknown"

const details = await client.transaction.getDetails(status.objectReference);
```

### Securing your callback endpoint
MVola does not sign its callbacks. Sign the URL you give it (HMAC of your reference, in the single
query parameter), verify it in constant time, **and confirm the verdict with `getStatus` before
crediting anything**: the URL is visible to MVola's gateway and to your own request logs, so the
signature alone does not prove who sent the verdict.

## API

### `new MVolaClient(config)`

| Option | Type | Required | Default |
|---|---|---|---|
| `consumerKey`, `consumerSecret` | `string` | Yes | — |
| `partnerName` | `string` | Yes | — |
| `merchantAccount` | `string` | Yes | — |
| `sandbox` | `boolean` | No | `true` |
| `baseUrl` | `string` (https only, no credentials) | No | sandbox `https://pre-api.mvola.mg`, production `https://api.mvola.mg` |
| `timeoutMs` | `number` | No | `20000` |

### `client.transaction.initiate(params)`

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `amount` | `number` | Yes | positive integer, Ariary |
| `description` | `string` | Yes | max 50 characters; characters other than letters, digits, space and `- . _ ,` are replaced |
| `debitParty` | `string` | Yes | Madagascar number; must differ from `creditParty` |
| `creditParty` | `string` | Yes | |
| `reference` | `string` | No | 1-50 chars, `A-Za-z0-9 - . _ ,`; default: random UUID. Use it to make retries idempotent |
| `callbackUrl` | `string` | No | https, at most one query parameter |
| `partnerName` | `string` | No | default: the client's `partnerName` |
| `currency` | `string` | No | `"Ar"` |
| `fc`, `amountFc` | `string` | No | `"USD"`, `"1"` |
| `language` | `"FR" \| "MG"` | No | `"FR"` |

Returns `{ status, serverCorrelationId, notificationMethod, reference }`.

### `client.transaction.getStatus(serverCorrelationId)` · `getDetails(transactionId)`
Path parameters are URL-encoded; empty or oversized ids are rejected locally.

## Changelog

### 0.3.0
- **Fix: the published 0.2.0 could not be loaded** (`require` and `import` both failed: ESM output without
  extensions). The build is now CommonJS, loadable from both, and the CI loads the built package.
- Metadata sent in the documented order; callback URL validated (one query parameter).
- Single-flight token + one retry on `401`; per-request timeout; typed errors incl. `MvolaUncertainOutcomeError`.
- Local validation of amount, numbers, description, reference and URLs; `reference` option; path parameters encoded.
- `baseUrl` and `timeoutMs` options; credentials kept in private fields.
- `initiate` now also returns the `reference` used. Invalid input now throws instead of being sent.

## License

MIT
