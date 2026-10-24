---
name: buyback-pools
description: Find and explain live or completed buyback.cafe pools on Robinhood Chain and BNB Smart Chain. Use when a user asks about Buyback pools, the token needed to participate, pool budgets, deadlines, or contract addresses.
---

# Buyback pools for agents

This skill gives agents a public, read-only entry point. Reading pools needs no wallet, account, CLI, npm package, or API key.

## One data source

Fetch `https://buyback.cafe/api/v1/overview` with an HTTP GET and `Accept: application/json`. Use the live response; do not present examples or cached values as current data. A failed or timed-out request means data is unavailable, not that there are zero pools.

The response has `networks[]`. Supported live networks and their Factory addresses are:

| Network | `chainId` | Factory |
| --- | ---: | --- |
| Robinhood Chain | 4663 | `0x3CF0cFAda3a3CdE38Cb622fEf8923a5f71a86C9C` |
| BNB Smart Chain | 56 | `0x8ed655c529004E7db3F46304140e5880aC09991B` |

Match both `chainId` and `factory` before using a network. If its `ready` is false, say that its index is unavailable. If the top-level `partial` flag is true, explain that the cross-chain list is incomplete. `indexedAtBlock` and `lastSuccessAt` indicate index freshness; a recently created pool or transaction may not appear immediately.

Each network's `pools[]` includes the pool address, `buyToken` (the project token participants deposit), `payToken` (the payment asset participants may receive), `start`, `end`, `rewardAmount`, `effectiveRewardAmount`, `totalDeposited`, and `participantCount`. Treat `start` and `end` as Unix seconds. Before `start` a pool is scheduled; from `start` until `end` it is live; after `end` it is completed. Use the token's `decimals` when formatting raw token amounts. Never equate a token's symbol or logo with its contract identity.

## Answering a pool question

1. Fetch the overview and select only the requested network and status.
2. Report the network, pool address, deposit token symbol **and contract address**, payment asset, budget, end time, and index freshness. If a value is missing, say so instead of guessing.
3. Link to `https://buyback.cafe/pool?address=<pool-address>` for Robinhood Chain, or `https://buyback.cafe/pool?address=<pool-address>&network=bsc` for BNB Smart Chain.
4. Explain that indexed data may trail chain state. Check live contract state before any transaction.

Example user request: “Read `https://buyback.cafe/api/v1/overview` and show the live BSC Buyback pools, including the deposit-token contract address.”

## Transactions are a separate step

This read-only skill does not connect a wallet, sign, or broadcast. If a user chooses a BSC pool and asks to deposit or claim, the optional `scripts/buyback.mjs` adapter in this repository can verify that pool against the BSC Factory and prepare unsigned calls. Follow the repository README for its setup. Show the exact chain, pool, token, amount, allowance, and wallet preview before the user confirms each transaction. Robinhood Chain transaction preparation is not included in that adapter.

