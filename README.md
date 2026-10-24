# Buyback × Binance Agentic Wallet

An agent skill for discovering and joining [buyback.cafe](https://buyback.cafe) pools on BNB Smart Chain with Binance Agentic Wallet. It reads public pool and chain data, then prepares transaction data for Binance's official wallet tool. It never holds wallet keys or sends transactions itself.

This adapter currently supports BNB Smart Chain (`chainId 56`) only. The Buyback product also runs on Robinhood Chain, but that network is not implemented here.

## Install

1. Install the [official Binance Agentic Wallet skill and `baw` CLI](https://github.com/binance/binance-skills-hub/tree/main/skills/binance-web3/binance-agentic-wallet) following Binance's instructions.
2. Install this skill in an agent that supports the Skills format:

   ```bash
   npx skills add joshua2ai/buyback-agentic-wallet
   ```

3. In this skill's directory, install its pinned dependency:

   ```bash
   npm ci --ignore-scripts
   ```

4. Sign in to your Agentic Wallet using Binance's instructions. For external contract calls, enable Developer Mode in the Binance App. Use `baw wallet address --json` to find your BSC wallet address.

Installing a GitHub skill does not automatically add Buyback to Binance AI's built-in tools. Run it in an agent environment that supports installed skills.

## Read-only examples

```bash
node scripts/buyback.mjs list
node scripts/buyback.mjs inspect --pool 0xPOOL_ADDRESS --wallet 0xYOUR_BSC_WALLET
```

The list command uses Buyback's public index when available. Pool inspection verifies the pool against the BSC Factory registry and reads state onchain. The default RPC is BNB Chain's public endpoint; set `BUYBACK_BSC_RPC_URL` to a trusted BSC RPC if needed.

## Prepare a transaction

```bash
node scripts/buyback.mjs deposit --pool 0xPOOL_ADDRESS --wallet 0xYOUR_BSC_WALLET --amount 100
node scripts/buyback.mjs claim --pool 0xPOOL_ADDRESS --wallet 0xYOUR_BSC_WALLET
```

These commands output transaction calls; they do **not** sign or broadcast. For each call, use the official `baw contract-call preview` flow, review the target, value, token and risk result, and execute only after the wallet owner explicitly confirms. When ERC-20 approval is needed, this adapter requests the exact deposit amount. A claim can pay out the payment asset or, for a funder, the purchased-token allocation; see [SKILL.md](SKILL.md) for the full workflow.

The BSC Factory is [`0x8ed655c529004E7db3F46304140e5880aC09991B`](https://bscscan.com/address/0x8ed655c529004E7db3F46304140e5880aC09991B). Always verify the project token address, pool address and transaction preview. Pools and tokens can carry financial risk. The upgradeable contracts have not been independently audited; start with a small amount.

## Development

```bash
npm ci --ignore-scripts
npm test
```

The adapter is maintained in the Buyback product source and published here as a standalone skill. See the [developer docs](https://buyback.cafe/docs) for contract rules and other integration paths.
