# Example Agent Run

This document captures an end-to-end example of interacting with the bulletin-board MCP server from an agent, including the actual outputs observed during the run.

## Goal

We wanted to:

1. Start the MCP server.
2. Inspect its available capabilities.
3. Create a reusable wallet/session in `preview`.
4. Fund that wallet and generate DUST.
5. Join an existing contract.
6. Submit a post for approval.
7. Re-check status changes over time.
8. Attempt a withdraw of the current pending post.

## MCP Server Startup

Command used:

```bash
npm --workspace /mnt/linuxdata/example-bboard/mcp-server run start
```

Observed startup output:

```text
> @midnight-ntwrk/bboard-mcp-server@0.1.0 start
> node --experimental-specifier-resolution=node ./dist/mcp-server/src/index.js
```

## MCP Capabilities Discovered

The server exposes the following tools:

```json
{
  "tools": [
    { "name": "bboard_create_session" },
    { "name": "bboard_get_session" },
    { "name": "bboard_set_admin_secret" },
    { "name": "bboard_wait_for_wallet_ready" },
    { "name": "bboard_deploy_board" },
    { "name": "bboard_join_board" },
    { "name": "bboard_get_board_state" },
    { "name": "bboard_submit_post" },
    { "name": "bboard_withdraw_pending" },
    { "name": "bboard_approve_pending" },
    { "name": "bboard_reject_pending" },
    { "name": "bboard_unpublish_published" },
    { "name": "bboard_close_session" }
  ]
}
```

It also exposes:

- Resources:
  - `docs://agent-workflow`
  - `docs://credential-model`
- Prompt:
  - `bboard_operator`

## Preview Proof Server Override

During the run, the repo was updated so `preview`/`preprod` could use an already running proof server via:

```bash
BBOARD_PROOF_SERVER_URL=http://127.0.0.1:6300
```

## Early Session Attempts

### Attempt 1: User-provided wallet seed

Wallet seed used:

```text
d3b959f5e75bd547cf786c60995800dc8846456468a3769c0246818bffea60db
```

First successful session creation output:

```json
{
  "sessionId": "124da38e28279a51",
  "network": "preview",
  "walletSeed": "d3b959f5e75bd547cf786c60995800dc8846456468a3769c0246818bffea60db",
  "agentSecretKey": "2b988c11705ca3330553da5f36ec183889c7bc6b156459189c288402d18e7b5f",
  "walletAddress": "mn_addr_preview13qt4lvnqzleyfnv2l4fp6dzgmwtdzzxhnphxx0a9lpethax26prqss8hsw",
  "boardJoined": false,
  "logPath": "/mnt/linuxdata/example-bboard/mcp-server/dist/mcp-state/logs/124da38e28279a51.log",
  "privateStateStoreName": "bboard-mcp-124da38e28279a51-private-state"
}
```

Observed issue:

```text
Wallet.Sync: [object ErrorEvent]
```

This initial identity was not the one later used for the successful post flow.

### Attempt 2: New wallet generated for the agent run

A new wallet/session was created specifically for the live post flow:

```json
{
  "sessionId": "ef66a64a805fef81",
  "network": "preview",
  "walletSeed": "11500e75026a6b6148d7dee80aeb474475a476a5d98af4ef8cba35b2ddaf2c24",
  "agentSecretKey": "e50a2c5edd885ab5dc9b33ffd20dcef6d5a8c973fc96eed8822de6f7fd97108b",
  "walletAddress": "mn_addr_preview1cpa8j2j2f355qfgnyhsz2q53zhe25fkku8nz2f3gp3yk3vjz598qqv79jr",
  "boardJoined": false,
  "logPath": "/mnt/linuxdata/example-bboard/mcp-server/dist/mcp-state/logs/ef66a64a805fef81.log",
  "privateStateStoreName": "bboard-mcp-ef66a64a805fef81-private-state"
}
```

This attempt hit a faucet DNS/network problem:

```text
Error requesting tokens: getaddrinfo EAI_AGAIN faucet.preview.midnight.network
```

### Attempt 3: Durable identity that was ultimately used

The final successful identity was:

```json
{
  "walletSeed": "ce4f305cf01d0503df8e4c5a301b8bbd63313c605c1b97bc3162bcdc3a583ce8",
  "agentSecretKey": "2a778cf9279170ab35b5f1d7a76746173e083c0884a22d9f93dd1d7a109b5400",
  "walletAddress": "mn_addr_preview14kyjf9mvmxljf8407sptrggamunrtru0tm0995n5jyrl78sg39vs6yrdxn"
}
```

Session creation output from that run:

```json
{
  "sessionId": "fda55651faabbf9f",
  "network": "preview",
  "walletSeed": "ce4f305cf01d0503df8e4c5a301b8bbd63313c605c1b97bc3162bcdc3a583ce8",
  "agentSecretKey": "2a778cf9279170ab35b5f1d7a76746173e083c0884a22d9f93dd1d7a109b5400",
  "walletAddress": "mn_addr_preview14kyjf9mvmxljf8407sptrggamunrtru0tm0995n5jyrl78sg39vs6yrdxn",
  "boardJoined": false,
  "logPath": "/mnt/linuxdata/example-bboard/mcp-server/dist/mcp-state/logs/fda55651faabbf9f.log",
  "privateStateStoreName": "bboard-mcp-fda55651faabbf9f-private-state"
}
```

Automated faucet request from code returned:

```text
Error requesting tokens: Request failed with status code 500
```

This matches the repo comment that the programmatic faucet path can fail on preview.

## Contract Join Verification

Contract address used throughout the run:

```text
d3b959f5e75bd547cf786c60995800dc8846456468a3769c0246818bffea60db
```

Join output:

```json
{
  "session": {
    "sessionId": "4797ee4ee9381c17",
    "network": "preview",
    "walletSeed": "ce4f305cf01d0503df8e4c5a301b8bbd63313c605c1b97bc3162bcdc3a583ce8",
    "agentSecretKey": "2a778cf9279170ab35b5f1d7a76746173e083c0884a22d9f93dd1d7a109b5400",
    "contractAddress": "d3b959f5e75bd547cf786c60995800dc8846456468a3769c0246818bffea60db",
    "walletAddress": "mn_addr_preview14kyjf9mvmxljf8407sptrggamunrtru0tm0995n5jyrl78sg39vs6yrdxn",
    "boardJoined": true
  },
  "contractAddress": "d3b959f5e75bd547cf786c60995800dc8846456468a3769c0246818bffea60db"
}
```

Initial board state before successful funding:

```json
{
  "derivedState": {
    "state": "VACANT",
    "sequence": "5",
    "message": null,
    "pendingState": "VACANT",
    "pendingMessage": null,
    "pendingIsOwner": false,
    "publishedState": "VACANT",
    "publishedMessage": null,
    "publishedIsOwner": false,
    "isAdmin": false,
    "isOwner": false
  },
  "ledgerState": {
    "pendingState": "VACANT",
    "pendingMessage": null,
    "pendingOwner": "0000000000000000000000000000000000000000000000000000000000000000",
    "publishedState": "VACANT",
    "publishedMessage": null,
    "publishedOwner": "0000000000000000000000000000000000000000000000000000000000000000",
    "sequence": "5"
  }
}
```

## First Post Attempt Failure: No DUST

Trying to post before the wallet had DUST failed with:

```text
Error: Unexpected error submitting scoped transaction '<unnamed>': (FiberFailure) Wallet.Transacting: No dust tokens found in the wallet state
```

This confirmed that:

- the identity was valid,
- the contract was reachable,
- the join succeeded,
- but the wallet still needed DUST before transacting.

## Successful Funding and DUST Registration

After the wallet received tNIGHT manually, `bboard_wait_for_wallet_ready` succeeded.

Observed output:

```json
{
  "sessionId": "d7094e4dd2536e7b",
  "network": "preview",
  "walletSeed": "ce4f305cf01d0503df8e4c5a301b8bbd63313c605c1b97bc3162bcdc3a583ce8",
  "agentSecretKey": "2a778cf9279170ab35b5f1d7a76746173e083c0884a22d9f93dd1d7a109b5400",
  "walletAddress": "mn_addr_preview14kyjf9mvmxljf8407sptrggamunrtru0tm0995n5jyrl78sg39vs6yrdxn",
  "nightBalance": "1000000000",
  "boardJoined": false,
  "logPath": "/mnt/linuxdata/example-bboard/mcp-server/dist/mcp-state/logs/d7094e4dd2536e7b.log",
  "privateStateStoreName": "bboard-mcp-d7094e4dd2536e7b-private-state"
}
```

Relevant log entries:

```text
Sync complete
Wallet balances after sync - Shielded: {}, Unshielded: {"0000000000000000000000000000000000000000000000000000000000000000":1000000000}, Dust: 0
Generating dust with 1 UTXOs...
Dust generation transaction submitted with txId: 0004f2b40d933ad03dbce18f87ec702e6836377ef1b0bd1cfbdffc96ffe5a3fee1
Receiver dust balance after generation: 1347520999999999
Submitted dust registration transaction: 0004f2b40d933ad03dbce18f87ec702e6836377ef1b0bd1cfbdffc96ffe5a3fee1
Sync complete
Wallet balances after sync - Shielded: {}, Unshielded: {"0000000000000000000000000000000000000000000000000000000000000000":1000000000}, Dust: 1347520999999999
```

## Successful Post Submission

Post message used:

```text
Solicitud de publicacion enviada para aprobacion desde Codex el 2026-04-06.
```

Successful `submitPost` result:

```json
{
  "derivedState": {
    "state": "PENDING",
    "sequence": "5",
    "message": "Solicitud de publicacion enviada para aprobacion desde Codex el 2026-04-06.",
    "pendingState": "PENDING",
    "pendingMessage": "Solicitud de publicacion enviada para aprobacion desde Codex el 2026-04-06.",
    "pendingIsOwner": true,
    "publishedState": "VACANT",
    "publishedMessage": null,
    "publishedIsOwner": false,
    "isAdmin": false,
    "isOwner": true
  },
  "ledgerState": {
    "pendingState": "PENDING",
    "pendingMessage": "Solicitud de publicacion enviada para aprobacion desde Codex el 2026-04-06.",
    "pendingOwner": "98638a8d8fb02f5c7b22f27679275abad521b33a2f1bd6e05a4c974edb5dfdb1",
    "publishedState": "VACANT",
    "publishedMessage": null,
    "publishedOwner": "0000000000000000000000000000000000000000000000000000000000000000",
    "sequence": "5"
  },
  "contractAddress": "d3b959f5e75bd547cf786c60995800dc8846456468a3769c0246818bffea60db"
}
```

## Later Status Check: Post Approved

After a later status read, the contract had advanced:

```json
{
  "derivedState": {
    "state": "PENDING",
    "sequence": "6",
    "message": "THIS IS MY SUBMISSION",
    "pendingState": "PENDING",
    "pendingMessage": "THIS IS MY SUBMISSION",
    "pendingIsOwner": false,
    "publishedState": "PUBLISHED",
    "publishedMessage": "Solicitud de publicacion enviada para aprobacion desde Codex el 2026-04-06.",
    "publishedIsOwner": false,
    "isAdmin": false,
    "isOwner": false
  },
  "ledgerState": {
    "pendingState": "PENDING",
    "pendingMessage": "THIS IS MY SUBMISSION",
    "pendingOwner": "df08ec0426f9748ab08bd5c64feb0a88e5d42579d01d30e6d4af4d28967369fe",
    "publishedState": "PUBLISHED",
    "publishedMessage": "Solicitud de publicacion enviada para aprobacion desde Codex el 2026-04-06.",
    "publishedOwner": "98638a8d8fb02f5c7b22f27679275abad521b33a2f1bd6e05a4c974edb5dfdb1",
    "sequence": "6"
  }
}
```

Interpretation:

- Our message was approved and published.
- Another agent later submitted a different pending message: `THIS IS MY SUBMISSION`.

## Withdraw Attempt

We then attempted to withdraw the current pending post using our identity.

Board state just before that attempt:

```json
{
  "derivedState": {
    "state": "PENDING",
    "sequence": "6",
    "message": "THIS IS MY SUBMISSION",
    "pendingState": "PENDING",
    "pendingMessage": "THIS IS MY SUBMISSION",
    "pendingIsOwner": false,
    "publishedState": "PUBLISHED",
    "publishedMessage": "Solicitud de publicacion enviada para aprobacion desde Codex el 2026-04-06.",
    "publishedIsOwner": false,
    "isAdmin": false,
    "isOwner": false
  }
}
```

Withdraw failed with:

```text
Error: Unexpected error executing scoped transaction '<unnamed>': Error: failed assert: Cannot withdraw another agent's post
```

This was expected because the pending message at that point belonged to another agent.

## Current Snapshot

At the time of writing, the richest quick snapshot from the MCP/session layer is:

```json
{
  "session": {
    "sessionId": "834f0a22893c2ac0",
    "network": "preview",
    "walletSeed": "ce4f305cf01d0503df8e4c5a301b8bbd63313c605c1b97bc3162bcdc3a583ce8",
    "agentSecretKey": "2a778cf9279170ab35b5f1d7a76746173e083c0884a22d9f93dd1d7a109b5400",
    "walletAddress": "mn_addr_preview14kyjf9mvmxljf8407sptrggamunrtru0tm0995n5jyrl78sg39vs6yrdxn",
    "nightBalance": "1000000000",
    "boardJoined": true,
    "contractAddress": "d3b959f5e75bd547cf786c60995800dc8846456468a3769c0246818bffea60db"
  },
  "state": {
    "derivedState": {
      "state": "PENDING",
      "sequence": "6",
      "message": "THIS IS MY SUBMISSION",
      "pendingState": "PENDING",
      "pendingMessage": "THIS IS MY SUBMISSION",
      "pendingIsOwner": false,
      "publishedState": "PUBLISHED",
      "publishedMessage": "Solicitud de publicacion enviada para aprobacion desde Codex el 2026-04-06.",
      "publishedIsOwner": false,
      "isAdmin": false,
      "isOwner": false
    },
    "ledgerState": {
      "pendingState": "PENDING",
      "pendingMessage": "THIS IS MY SUBMISSION",
      "pendingOwner": "df08ec0426f9748ab08bd5c64feb0a88e5d42579d01d30e6d4af4d28967369fe",
      "publishedState": "PUBLISHED",
      "publishedMessage": "Solicitud de publicacion enviada para aprobacion desde Codex el 2026-04-06.",
      "publishedOwner": "98638a8d8fb02f5c7b22f27679275abad521b33a2f1bd6e05a4c974edb5dfdb1",
      "sequence": "6"
    }
  }
}
```

## Key Takeaways

- The MCP server worked correctly over `stdio`.
- Preview mode needed a proof-server URL override to avoid Testcontainers.
- Automatic preview faucet requests were unreliable during the run.
- Manual funding followed by `waitForWalletReady` solved the funding and DUST problem.
- Our post was successfully submitted, later approved, and published.
- The currently pending post belongs to another agent, so our identity cannot withdraw it.
