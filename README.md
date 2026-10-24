# Buyback for AI agents

One public entry point lets an agent discover [buyback.cafe](https://buyback.cafe) pools on Robinhood Chain and BNB Smart Chain. Pool lookup requires no wallet or installation.

## Start with one link

Give a web-enabled agent [SKILL.md](SKILL.md), or ask it directly:

> Read https://buyback.cafe/api/v1/overview and list the live BNB Smart Chain Buyback pools. Include each deposit-token contract address, payment asset, budget, deadline, and pool link. Do not initiate a transaction.

The same request can target Robinhood Chain. `SKILL.md` defines the network identities, field meanings, freshness checks, and pool links. The website and agents read the same index; the index can lag the chain by a few blocks. A wallet is needed only when the user later chooses an onchain action.

Agents with Skills support can install the guide for reuse:

```bash
npx skills add joshua2ai/buyback-agentic-wallet
```

Publishing a skill does not place Buyback in Binance AI's built-in tool list. The user can provide this link to an agent that can read public URLs; automatic discovery inside a particular app depends on that app.

## Optional BSC transaction preparation

The `scripts/buyback.mjs` adapter is for BNB Smart Chain (`chainId 56`). It verifies a pool against the BSC Factory and prepares unsigned deposit or claim calls. It does not hold keys, sign, or broadcast. Robinhood Chain transaction preparation is outside this adapter.

In this repository, install the pinned dependency:

```bash
npm ci --ignore-scripts
```

Read-only inspection and unsigned call examples:

```bash
node scripts/buyback.mjs list
node scripts/buyback.mjs inspect --pool 0xPOOL_ADDRESS --wallet 0xYOUR_BSC_WALLET
node scripts/buyback.mjs deposit --pool 0xPOOL_ADDRESS --wallet 0xYOUR_BSC_WALLET --amount 100
node scripts/buyback.mjs claim --pool 0xPOOL_ADDRESS --wallet 0xYOUR_BSC_WALLET
```

The script uses Buyback's public index when available and a BSC RPC for onchain verification. Set `BUYBACK_BSC_RPC_URL` to a reachable trusted BSC RPC when the default endpoint is unavailable. Its output is transaction data only. For Binance Agentic Wallet, install [Binance's official skill and `baw` CLI](https://github.com/binance/binance-skills-hub/tree/main/skills/binance-web3/binance-agentic-wallet), sign in through Binance's flow, and enable Developer Mode in the Binance App for external contract calls. Preview each call with `baw contract-call preview`; execute only after the wallet owner explicitly confirms it. The BSC Factory is [`0x8ed655c529004E7db3F46304140e5880aC09991B`](https://bscscan.com/address/0x8ed655c529004E7db3F46304140e5880aC09991B).

Before any deposit, verify the project-token contract address, pool address, amount, and wallet preview. Tokens and pools carry financial risk. The upgradeable contracts have not been independently audited; start with a small amount.

## Development

```bash
npm ci --ignore-scripts
npm test
```

This skill is maintained in the [Buyback product source](https://buyback.cafe/docs) and published here as its public agent entry point.

