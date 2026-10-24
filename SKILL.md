---
name: buyback-bsc-agentic-wallet
description: Discover BNB Smart Chain Buyback pools and prepare verified deposit or claim transactions for Binance Agentic Wallet. Use when a user asks an agent to find, join, or claim from a buyback.cafe BSC pool.
---

# Buyback on BNB Smart Chain

This skill prepares transactions for the official Binance Agentic Wallet skill. It does not hold keys, connect wallets, or broadcast transactions. This adapter currently supports only BNB Smart Chain (`chainId 56`); Robinhood Chain pools are outside this adapter's scope.

## Setup

Install the official [Binance Agentic Wallet skill](https://github.com/binance/binance-skills-hub/tree/main/skills/binance-web3/binance-agentic-wallet) and its `baw` CLI according to Binance's instructions. The user must enable Developer Mode for external contract calls in the Binance app. In this skill's directory, run `npm ci --ignore-scripts`.

Run `node <this-skill-directory>/scripts/buyback.mjs help` for exact commands. Use `baw wallet address --json` from the official skill to obtain the Agentic Wallet address for chain 56. Never request a seed phrase, private key, or API secret.

## Workflow

1. List BSC pools with `node .../buyback.mjs list`. Show chain, pool address, deposit token contract, payment token, budget, status, and end time. Do not infer a token's legitimacy from its name or logo.
2. Inspect a pool with `node .../buyback.mjs inspect --pool <address> --wallet <agent-wallet-address>`. The script verifies the pool against the configured Factory's onchain `poolAt` registry and reads token metadata and wallet state onchain. Read the output before proposing an action.
3. For participation, run `node .../buyback.mjs deposit --pool <address> --wallet <agent-wallet-address> --amount <human-readable-token-amount>`. The result contains one or two ordered calls. If an approval is required, preview and execute it first, then rerun `deposit` to refresh allowance before the deposit. Approval is for the exact amount, never unlimited.
4. For a closed pool, run `node .../buyback.mjs claim --pool <address> --wallet <agent-wallet-address>`. It prepares a participant payout claim when the wallet contributed and has not already claimed. For a funder's purchased-token share, use `claim --kind purchased`. Native BNB purchased-token claims use the wrapped WBNB fallback, and the result identifies WBNB as the receiving token. The script does not prepare empty-pool refunds or pool creation.
5. For **each** call, use `baw contract-call preview --binanceChainId 56 --from <agent-wallet-address> --to <to> --value <wei> --inputData <hex> --json`. Show the recipient, method, token amount, token contract, and preview result to the user. Execute with `baw contract-call execute --requestId <preview-request-id> --json` only after explicit confirmation for that transaction. Never execute from a stale preview. Check the transaction result and refresh onchain state after execution.

The script checks the selected RPC's chain ID, Factory registry, pool configuration, timing, wallet limits, balance, allowance, and claim state. Binance's preview and its wallet limits remain the final transaction gate. Pool contracts are upgradeable and have not been independently audited; treat unknown tokens and pool addresses as financial risk. Start with a small amount.
