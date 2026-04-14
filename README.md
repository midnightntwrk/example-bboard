# Bulletin Board DApp

This project is built on the [Midnight Network](https://midnight.network/).

[![Generic badge](https://img.shields.io/badge/Compact%20Compiler-0.30.0-1abc9c.svg)](https://shields.io/)
[![Generic badge](https://img.shields.io/badge/TypeScript-5.9.3-blue.svg)](https://shields.io/)

A Midnight smart contract example demonstrating a simple one-item bulletin board with zero-knowledge proofs on testnet. Users can post a single message at a time, and only the message author can remove it.

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

You need Node.js:

```bash
node --version
```

Expected output: `v24.11.1` or higher. The repository includes an [.nvmrc](./.nvmrc) pinned to `24.11.1`.

If you get a lower version: [Install Node.js LTS](https://nodejs.org/).

### 2. Docker Installation

The [proof server](https://docs.midnight.network/develop/tutorial/using/proof-server) runs in Docker and is required for both CLI and UI to generate zero-knowledge proofs:

```bash
docker --version
```

Expected output: `Docker version X.X.X`.

If Docker is not found: [Install Docker Desktop](https://docs.docker.com/desktop/). Make sure Docker Desktop is running.

### 3. Lace Wallet Extension (UI Only)

For the web interface, install the official Lace wallet extension on [Chrome Store](https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk) or the [Edge Store](https://microsoftedge.microsoft.com/addons/detail/lace/efeiemlfnahiidnjglmehaihacglceia) (tested with version 1.36.0).

After installing, set up the Midnight wallet:

1. Create a **new wallet** — Midnight will appear as a network option
2. Set **Network** to **Preprod**
3. Set **Proof server** to **Local (http://localhost:6300)** — this must point to your local proof server started via Docker
4. Click **Enter Wallet**
5. Fund your wallet with tNIGHT tokens from the [Preprod Faucet](https://faucet.preprod.midnight.network/)
6. Go to **Tokens** in the wallet, click **Generate tDUST**, and confirm the transaction — tDUST tokens are required to pay transaction fees on preprod

## Setup Instructions

### Install Project Dependencies

```bash
npm install
```

This repository uses npm workspaces. Run installation once from the repository root.

### Compile the Smart Contract

The Compact compiler (`compactc 0.30.0`) generates TypeScript bindings and zero-knowledge circuits from the smart contract source code:

```bash
cd contract
npm run compact    # Compiles the Compact contract
npm run build      # Copies compiled files to dist/
cd ..
```

Expected output:

```
> compact
> compact compile src/bboard.compact ./src/managed/bboard

Compiling 2 circuits:
  circuit "post" (k=14, rows=10070)
  circuit "takeDown" (k=14, rows=10087)

> build
> rm -rf dist && tsc --project tsconfig.build.json && cp -Rf ./src/managed ./dist/managed && cp ./src/bboard.compact ./dist

```

### Build the CLI Interface

```bash
cd bboard-cli
npm run build
cd ..
```

### Build the UI Interface (Optional)

Only needed if you want to use the web interface:

```bash
cd bboard-ui
npm run build
cd ..
```

## Option 1: CLI Interface

### Start the Proof Server

The CLI requires a local proof server running in Docker:

```bash
cd bboard-cli
docker compose -f proof-server-local.yml up -d
```

This uses `midnightntwrk/proof-server:8.0.3` on `http://127.0.0.1:6300`.

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

Expected output is similar to:

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

Expected output after funding is similar to:

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
cd ..
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
- [Compatibility Matrix](https://docs.midnight.network/relnotes/support-matrix) - Current supported Midnight component versions
- [Compact Language Guide](https://docs.midnight.network/compact/writing) - Smart contract language reference
- Get Lace wallet on the [Chrome Store](https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk) or the [Edge Store](https://microsoftedge.microsoft.com/addons/detail/lace/efeiemlfnahiidnjglmehaihacglceia)

## Troubleshooting

| Common Issue                       | Solution                                                                                                  |
| ---------------------------------- |-----------------------------------------------------------------------------------------------------------|
| `npm install` fails                | Ensure you're using Node `v24.11.1` or newer. Older Node versions can install with warnings but are not the target runtime |
| Contract compilation fails         | Ensure the Compact toolchain is installed and run `npm run compact` from `contract/`                      |
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

## Implementation Notes

- **Transaction fee configuration**  
  The default `additionalFeeOverhead` value (`500_000_000_000_000_000n`) from `@midnight-ntwrk/testkit-js` is required on the `undeployed` network. Lower values can fail with `BalanceCheckOverspend` on the node side. On remote networks, that overhead requires too much dust, so the CLI overrides it to `1_000n`.
- CLI private state is stored per contract address, matching the `Midnight.js 4.x` private-state provider model.
