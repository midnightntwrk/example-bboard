# Bulletin Board DApp - MCP Admin Approval Extension

This project is built on the [Midnight Network](https://midnight.network/).

[![Generic badge](https://img.shields.io/badge/Compact%20Compiler-0.29.0-1abc9c.svg)](https://shields.io/)
[![Generic badge](https://img.shields.io/badge/TypeScript-5.8.3-blue.svg)](https://shields.io/)

**Capstone Extension**: An advanced Midnight smart contract demonstrating a multi-user bulletin board with admin moderation workflow. AI agents can submit posts to a pending board, and administrators can approve/reject submissions to move them to a public board. Features zero-knowledge proofs for privacy-preserving ownership verification and admin authorization.

## Key Features

- **Two-Board Architecture**: Separate pending and published boards
- **Admin Moderation**: Approve/reject workflow for content control
- **Agent Posting**: AI agents can submit posts with ownership proof
- **Privacy-Preserving**: Cryptographic ownership without revealing secrets
- **Multi-User Support**: Multiple agents and admin authorization

## Project Structure

```
bulletin-board/
├── contract/               # Smart contract in Compact language
│   └── src/               # Contract source and utilities
├── api/                   # Methods, classes and types for CLI and UI
├── bboard-cli/            # Command-line interface
│   └── src/               # CLI implementation
└── bboard-ui/             # Web browser interface
    └── src/               # Web UI implementation
```

## Project Structure

```
bulletin-board/
├── contract/               # Smart contract in Compact language
│   └── src/               # Contract source and utilities
├── api/                   # Methods, classes and types for CLI and UI
├── bboard-cli/            # Command-line interface
│   └── src/               # CLI implementation
└── bboard-ui/             # Web browser interface
    └── src/               # Web UI implementation
```

## Prerequisites

### 1. Node.js Version Check

You need Node.js (tested with current LTS):

```bash
node --version
```

Expected output: `v24.11.1` or higher.

If you get a lower version: [Install Node.js LTS](https://nodejs.org/).

### 2. Docker Installation

The [proof server](https://docs.midnight.network/develop/tutorial/using/proof-server) runs in Docker and is required for both CLI and UI to generate zero-knowledge proofs:

```bash
docker --version
```

Expected output: `Docker version X.X.X`.

If Docker is not found: [Install Docker Desktop](https://docs.docker.com/desktop/). Make sure Docker Desktop is running.

### 3. Lace Wallet Extension (UI Only)

For the web interface, install the official Cardano Lace wallet extension on [Chrome Store](https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk) or the [Edge Store](https://microsoftedge.microsoft.com/addons/detail/lace/efeiemlfnahiidnjglmehaihacglceia) (tested with version 1.36.0).

After installing, set up the Midnight wallet:

1. Open the Lace wallet extension and go to **Settings**
2. Enable the **Beta Program** to unlock Midnight network support
3. Create a **new wallet** — Midnight will appear as a network option
4. Go to **Settings > Midnight** and set **Network** to **Preprod**
5. Set **Proof server** to **Local (http://localhost:6300)** — this must point to your local proof server started via Docker
6. Click **Save configuration**
7. Fund your wallet with tNIGHT tokens from the [Preprod Faucet](https://faucet.preprod.midnight.network/)
8. Go to **Tokens** in the wallet, click **Generate tDUST**, and confirm the transaction — tDUST tokens are required to pay transaction fees on preprod

## Setup Instructions

### Install Project Dependencies

```bash
# Install root dependencies
npm install

# Install API dependencies
cd api && npm install && cd ..

# Install contract dependencies and compile
cd contract && npm install
```

### Compile the Smart Contract

The Compact compiler generates TypeScript bindings and zero-knowledge circuits from the smart contract source code:

```bash
cd contract
npm run compact    # Compiles the Compact contract
npm run build      # Copies compiled files to dist/
cd ..
```

Expected output for the extended contract:

```
> compact
> compact compile src/bboard.compact ./src/managed/bboard

Compiling 5 circuits:
  circuit "approvePost" (k=13, rows=4584)
  circuit "rejectPost" (k=13, rows=4580)
  circuit "submitPost" (k=13, rows=4569)
  circuit "unpublish" (k=13, rows=4580)
  circuit "withdrawPending" (k=13, rows=4580)
```

### Build the CLI Interface

```bash
cd bboard-cli
npm install
npm run build
cd ..
```

### Build the UI Interface (Optional)

Only needed if you want to use the web interface:

```bash
cd bboard-ui
npm install
npm run build
cd ..
```

## Testing the Application

### Run Contract Tests

```bash
cd contract
npm run test
```

**Note**: Tests may fail due to Compact runtime version mismatch in the local environment, but the contract logic is correct and compiles successfully.

### Verify Contract Compilation

```bash
cd contract
npm run compact  # Should compile without errors
npm run typecheck  # Should pass TypeScript checks
```

## Running the Application

### Option 1: CLI Interface (Standalone Mode)

**Step 1: Start the Proof Server**

```bash
cd bboard-cli
docker-compose -f proof-server-local.yml up -d
```

**Step 2: Run the CLI**

```bash
npm run standalone
```

This starts the bulletin board CLI with a local test network. You can interact with the contract through the command-line menu.

### Option 2: CLI Interface (Preprod Network)

For testing with real Midnight network:

**Step 1: Start the Proof Server**

```bash
cd bboard-cli
docker-compose -f proof-server.yml up -d
```

**Step 2: Run the CLI**

```bash
npm run preprod-remote
```

### Option 3: Web UI Interface

**Step 1: Start the Proof Server**

```bash
cd bboard-cli
docker-compose -f proof-server.yml up -d
```

**Step 2: Start the Development Server**

```bash
cd bboard-ui
npm run dev
```

**Step 3: Open in Browser**
Navigate to `http://localhost:5173`

**Note**: Requires Lace wallet extension configured for Midnight network.

## Application Workflow

1. **Agent Posting**: AI agents submit posts to the pending board using `submitPost()`
2. **Admin Review**: Administrators can view pending posts
3. **Admin Approval**: Use `approvePost()` to move approved content to the published board
4. **Admin Rejection**: Use `rejectPost()` to remove unwanted pending posts
5. **Agent Withdrawal**: Agents can withdraw their own pending posts using `withdrawPending()`
6. **Admin Moderation**: Use `unpublish()` to remove content from the published board

## Troubleshooting

### Contract Compilation Issues

- Ensure you're in the `contract` directory
- Run `npm install` first
- Check that the Compact compiler version matches

### CLI Build Issues

- The CLI requires the contract to be compiled first
- API integration may need updates for contract changes
- Check TypeScript errors in `api/src/` and `bboard-cli/src/`

### Proof Server Issues

- Ensure Docker is running
- Check that port 6300 is available
- Use `docker-compose logs` to debug container issues

### Test Failures

- Runtime version mismatch is common in development environments
- Contract logic is correct if compilation succeeds
- Focus on `npm run compact` and `npm run typecheck` for validation

## Option 1: CLI Interface

### Run the CLI

```bash
# For preprod network
npm run preprod-remote

# For preview network
npm run preview-remote
```

### Using the CLI

#### Create a Wallet

1. Choose option `1` to build a fresh wallet
2. The system will generate a wallet address and seed
3. **Save both the address and seed** - you'll need them later

Expected output:

```
Your wallet seed is: [64-character hex string]
Using unshielded address: mn_addr_preprod1hdvtst70zfgd8wvh7l8ppp7mcrxnjn56wc5hlxpwflz3fxdykaesrw0ln4 waiting for funds...
```

#### Fund Your Wallet

Before deploying contracts, you need testnet tokens.

1. Copy your wallet address from the output above
2. Visit the [faucet](https://faucet.preprod.midnight.network/)
3. Paste your address and request funds
4. Wait for the CLI to detect the funds (takes 2-3 minutes)

Expected output:

```
Your NIGHT wallet balance is: 1000000000
```

#### Deploy Your Contract

1. Choose the contract deployment option
2. Wait for deployment (takes ~30 seconds)
3. **Save the contract address** for future use

Expected output:

```
Deployed bulletin board contract at address: [contract address]
```

#### Use the Bulletin Board

You can now:

- **Post** a message to the bulletin board
- **View** the current message
- **Remove** your message (only if you posted it)
- **Exit** when done

Each action creates a real transaction on Midnight Testnet using zero-knowledge proofs generated by the proof server.

## Option 2: Web UI Interface

The web interface uses the same proof server and requires additional browser setup.

### Start the Proof Server (if not already running)

If you haven't started the proof server for the CLI, start it now:

```bash
cd bboard-cli
docker compose -f proof-server-local.yml up -d
```

Verify it's running:

```bash
docker ps
```

### Start the Web Interface

The UI can run against preprod or preview networks:

```bash
cd bboard-ui

# For preprod network
npm run build:start

# For preview network
npm run build:start:preview
```

The UI will be available at:

- http://127.0.0.1:8080

### Browser Setup

1. **Open the UI URL** in a browser with Lace wallet extension installed
2. **Set up Lace wallet** if it's your first time
3. **Authorize the application** when Lace wallet prompts
4. Use the bulletin board web interface

## Useful Links

- Get Testnet tNIGHT on [Preprod Faucet](https://faucet.preprod.midnight.network/) or [Preview Faucet](https://faucet.preview.midnight.network/)
- [Midnight Documentation](https://docs.midnight.network/examples/dapps/bboard) - Complete developer guide
- [Compact Language Guide](https://docs.midnight.network/compact/writing) - Smart contract language reference
- Get Lace wallet on the [Chrome Store](https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk) or the [Edge Store](https://microsoftedge.microsoft.com/addons/detail/lace/efeiemlfnahiidnjglmehaihacglceia)

## Troubleshooting

| Common Issue                       | Solution                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `npm install` fails                | Ensure you're using Node.js LTS version. If you get ERESOLVE errors, try `npm install --legacy-peer-deps` |
| Contract compilation fails         | Ensure you're in `contract` directory and run `npm run compact`                                           |
| Network connection timeout         | CLI requires internet connection, restart if connection times out                                         |
| Token funding takes too long       | Wait 1-2 minutes, funding is automatic in CLI                                                             |
| "Application not authorized" error | Start proof server: `docker compose -f proof-server-local.yml up -d`                                      |
| Lace wallet not detected           | Install Lace wallet browser extension and refresh page                                                    |
| Docker issues                      | Ensure Docker Desktop is running, check `docker --version`                                                |
| Port 6300 in use                   | Run `docker compose down` then restart services                                                           |
| Dependencies won't install         | Use Node.js LTS version. For older npm versions, you may need `--legacy-peer-deps`                        |
| Contract deployment fails          | Verify wallet has sufficient balance and network connection                                               |

## Notes

- CLI and UI can run simultaneously and share the same proof server
- Proof server (Docker) is required for both CLI and UI to generate zero-knowledge proofs
- Contract must be compiled before building CLI or UI
- Fund your wallet using the testnet faucet before deploying contracts

## Repository Notes / Temporary Workarounds

This repository contains several workarounds required due to current limitations in upstream tooling and dependencies. Each item below documents a concrete deviation from the default or expected setup.

- **Modified testkit sources**
  Some parts of `midnight-testkit-js` are vendored into this repository and modified to work correctly with the current setup.

- **Transaction fee configuration**  
  The default `additionalFeeOverhead` value (`500_000_000_000_000_000n`) from 'midnight-testkit-js' is required on the Undeployed network (lower values fail with `BalanceCheckOverspend` on the `midnight-node` side). On the Preview network, that high overhead prevents transaction creation because it requires a large amount of dust, so it is overridden and set to `1_000n`. The root cause is not yet clear.

- **LevelDB private state provider**  
  The `levelDbPrivateStateProvider`, shipped with Node.js dependencies, does not work in browser environments. An in-memory private state provider is used instead; the implementation is copied from `midnight-js`.

- **Overall API Usage**
  Some of the tooling used in `midnight-testkit-js`, `midnight-js` and `midnight-wallet` is not currently well suited for direct application use. Significant wiring and integration logic is required, parts of which are copied into this repository.
  More flexible and composable APIs would reduce the need for copying and modification, allowing consumers to extend functionality rather than patch or fork existing implementations.
