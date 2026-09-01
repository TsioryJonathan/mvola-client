# mvola-client

Modern MVola API client for Node.js — native `fetch`, zero runtime dependencies.

## Install

```sh
npm install mvola-client
```

## Quick Start

```typescript
import { MVolaClient } from "mvola-client";

const client = new MVolaClient({
  consumerKey: process.env.MVOLA_CONSUMER_KEY!,
  consumerSecret: process.env.MVOLA_CONSUMER_SECRET!,
  sandbox: true,
});
```

## Initiate a Transaction

```typescript
const tx = await client.transaction.initiate({
  amount: 10000,
  description: "Deepoz Wallet Deposit",
  debitParty: "0343500003",
  creditParty: "0343500004",
  partnerName: "Deepoz",
});

console.log(tx.serverCorrelationId);
```

## Check Transaction Status

```typescript
const status = await client.transaction.getStatus(serverCorrelationId);
console.log(status.status); // "completed" | "pending" | "failed"
```

## Get Transaction Details

```typescript
const details = await client.transaction.getDetails(transactionId);
console.log(details.amount);
```

## API Reference

### `MVolaClient(config)`

| Parameter | Type | Required | Default |
|---|---|---|---|
| `consumerKey` | `string` | Yes | — |
| `consumerSecret` | `string` | Yes | — |
| `sandbox` | `boolean` | No | `true` |

### `client.transaction.initiate(params)`

| Parameter | Type | Required | Default |
|---|---|---|---|
| `amount` | `number` | Yes | — |
| `currency` | `string` | No | `"Ar"` |
| `description` | `string` | Yes | — |
| `debitParty` | `string` | Yes | — |
| `creditParty` | `string` | Yes | — |
| `partnerName` | `string` | No | — |
| `callbackUrl` | `string` | No | — |
| `language` | `"FR" \| "MG"` | No | `"FR"` |

### `client.transaction.getStatus(serverCorrelationId)`

Returns `TransactionStatus` with `status`, `serverCorrelationId`, `notificationMethod`, `objectReference`.

### `client.transaction.getDetails(transactionId)`

Returns full `TransactionDetails` including amount, parties, metadata, fees.

## License

MIT
