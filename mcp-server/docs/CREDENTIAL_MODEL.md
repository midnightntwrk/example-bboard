# Credential Model

This MCP server makes the credential story explicit so other projects can reuse the same pattern.

## Three credentials matter

### 1. `walletSeed`

This is the Midnight wallet seed used to derive the transaction-signing wallet. It is needed for funding, dust registration, and transaction submission.

### 2. `agentSecretKey`

This is contract private state, not the wallet seed. The contract uses it to derive the public owner key for posts.

### 3. `adminSecret`

This is also contract private state. It is the credential that proves moderation authority for `approve`, `reject`, and `unpublish`.

The MCP server treats it as write-only input:

- it may be provided to `bboard_create_session`, or later through `bboard_set_admin_secret`,
- it is never returned by `bboard_get_session`,
- it is never included in board state responses,
- it is never exposed as an MCP resource.

## Why not derive everything from one seed?

For this repo, the wallet identity and the contract witnesses are distinct concerns:

- the wallet seed funds and submits transactions,
- the contract secrets control ownership and moderation inside the contract.

Keeping them separate makes the template usable for similar Midnight projects where on-chain witness identity and wallet identity may evolve independently.

## Session persistence

The server keeps a private-state LevelDB per session under `mcp-state/`, but agents should still persist their own reusable credentials themselves. The LevelDB is a convenience cache for the running server, not the canonical identity record for an agent.
