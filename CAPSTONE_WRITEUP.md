# Capstone Project: Bulletin Board DApp with Agent MCP Integration

## Overview

This capstone extends the Midnight bulletin board example into a moderated multi-user workflow and adds an MCP server so AI agents can operate the board through a controlled tool interface.

The core on-chain model is intentionally simple:

- one pending slot for submissions awaiting review
- one published slot for approved content

This keeps the contract small and auditable while still demonstrating:

- agent ownership proofs
- admin moderation
- privacy-preserving witnesses
- client reuse through a shared TypeScript API
- agent integration through MCP

## Architecture

The repository is organized into five layers:

1. `contract/`
   Compact contract, witnesses, generated artifacts, and tests.
2. `api/`
   Shared TypeScript interface for deploying, joining, reading, and mutating the board.
3. `bboard-cli/`
   Interactive terminal client for human operators.
4. `bboard-ui/`
   Browser UI using Lace and Midnight client integrations.
5. `mcp-server/`
   `stdio` MCP server exposing board operations to agents as tools.

This structure lets multiple clients reuse the same business logic instead of each reimplementing contract calls independently.

## Contract Model

The contract maintains two board regions:

- `pending*` fields for submissions waiting for moderation
- `published*` fields for the currently visible approved content

Important ledger fields:

- `pendingState`
- `pendingMessage`
- `pendingOwner`
- `publishedState`
- `publishedMessage`
- `publishedOwner`
- `sequence`
- `adminPubKey`

Important witness/private fields:

- `localSecretKey()`
- `adminSecret()`

The state transitions are:

- `VACANT -> PENDING` on agent submission
- `PENDING -> VACANT` on withdrawal or rejection
- `PENDING -> PUBLISHED` on approval
- `PUBLISHED -> VACANT` on unpublish

When a slot becomes vacant, both the message and owner are cleared.

## Authorization and Privacy

### Agent authorization

Agents prove ownership by deriving a public owner key from their private agent secret and the sequence counter. This allows the contract to verify who owns a pending post without revealing the agent secret itself.

### Admin authorization

Admin operations are authorized by proving possession of the admin secret, which derives the on-chain `adminPubKey`.

At the contract level, `adminPubKey` is part of public ledger state because the authorization check needs a public comparison target.

### MCP privacy boundary

The MCP server applies a stricter application-layer privacy policy than the raw contract API:

- it never returns `adminSecret`
- it never returns `adminPubKey`
- `adminSecret` is treated as write-only input

This means the contract may still maintain `adminPubKey` on-chain, but the agent-facing MCP layer refuses to expose it.

## API Layer

The shared `api/` package wraps contract deployment, joining, state observation, and transaction submission.

Main operations exposed by `BBoardAPI`:

- `deploy`
- `join`
- `post`
- `takeDown`
- `approvePending`
- `rejectPending`
- `unpublishPublished`

It also derives useful client-facing state such as:

- current visible state
- ownership booleans
- current message selection

This keeps the CLI, UI, and MCP layers thin and consistent.

## MCP Server Design

The MCP server is implemented as a `stdio` server so it can be launched directly by MCP-capable agent runtimes.

It exposes:

- tools
- resources
- prompts

### Tools

- `bboard_create_session`
- `bboard_get_session`
- `bboard_set_admin_secret`
- `bboard_wait_for_wallet_ready`
- `bboard_deploy_board`
- `bboard_join_board`
- `bboard_get_board_state`
- `bboard_submit_post`
- `bboard_withdraw_pending`
- `bboard_approve_pending`
- `bboard_reject_pending`
- `bboard_unpublish_published`
- `bboard_close_session`

### Resources

- `docs://agent-workflow`
- `docs://credential-model`

### Prompt

- `bboard_operator`

## MCP Credential Model

The MCP layer separates three concepts:

### 1. Wallet seed

`walletSeed` pays fees and signs transactions on Midnight.

### 2. Agent secret

`agentSecretKey` is contract private state used to prove ownership of pending posts.

### 3. Admin secret

`adminSecret` is contract private state used to authorize moderation.

The server allows the admin secret to be provided, but it is never returned in responses.

This separation makes the MCP implementation a reusable template for similar Midnight DApps where:

- transaction identity
- contract witness identity
- privileged moderation authority

may need to be managed independently.

## Design Trade-offs

### Why single-slot boards?

The design favors clarity over throughput:

- less complex state logic
- simpler moderation flow
- easier privacy review
- easier end-to-end testing

### Why keep wallet seed separate from contract secrets?

Because the wallet pays for transactions while contract witnesses prove role-specific authority. Keeping them separate makes agent orchestration more explicit and safer.

### Why hide admin data in MCP if the contract has `adminPubKey`?

Because the MCP server is an application boundary, not a mirror of every raw contract field. Its job is to expose only what agents need to act safely.

## Testing Strategy

The repo validates behavior at multiple levels:

- contract tests for circuit logic and state transitions
- typechecks for API, CLI, and MCP layers
- runtime startup checks for the MCP server

Covered contract behaviors include:

- submit
- withdraw
- approve
- reject
- unpublish
- owner clearing when slots become vacant

## Outcome

The project now demonstrates a full stack Midnight workflow:

- on-chain moderation logic
- shared client API
- human-facing CLI and UI
- agent-facing MCP integration

It also demonstrates an important practical pattern for agent systems: the MCP layer can provide strong operational tools while still enforcing stricter secrecy rules than the raw underlying protocol surface.
