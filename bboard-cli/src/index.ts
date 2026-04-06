// capstone/dan-laduke — NFT Trade Offer Board CLI
// SPDX-License-Identifier: Apache-2.0

/*
 * Interactive CLI for the NFT Trade Offer Board.
 *
 * Privacy note: when creating an offer, the CLI computes the offeree commitment
 * locally (off-chain) and prints the offer ID + salt so the user can share them
 * privately with their counterparty (e.g. via encrypted DM). The salt never
 * leaves the local machine or appears on-chain.
 */

import { createInterface, type Interface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { WebSocket } from 'ws';
import {
  NFTTradeAPI,
  type NFTTradeDerivedState,
  nftTradePrivateStateKey,
  type NFTTradeProviders,
  type DeployedNFTTradeContract,
  type PrivateStateId,
} from '../../api/src/index';
import { type WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { ledger, type Ledger, OfferStatus } from '../../contract/src/managed/nft-trade/contract/index.js';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { type Logger } from 'pino';
import { type Config, StandaloneConfig } from './config.js';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import { assertIsContractAddress, toHex } from '@midnight-ntwrk/midnight-js-utils';
import { TestEnvironment } from '@midnight-ntwrk/testkit-js';
import { MidnightWalletProvider } from './midnight-wallet-provider';
import { randomBytes } from '../../api/src/utils';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v7';
import { syncWallet, waitForUnshieldedFunds } from './wallet-utils';
import { generateDust } from './generate-dust';
import { NFTTradePrivateState } from '@midnight-ntwrk/bboard-contract';

// @ts-expect-error: needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const hexToBytes = (hex: string): Uint8Array => {
  const cleaned = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

const statusLabel = (s: OfferStatus): string => {
  switch (s) {
    case OfferStatus.PENDING:    return 'PENDING';
    case OfferStatus.ACCEPTED:   return 'ACCEPTED';
    case OfferStatus.REJECTED:   return 'REJECTED';
    case OfferStatus.CANCELLED:  return 'CANCELLED';
    default: return 'UNKNOWN';
  }
};

// ─── Deploy / Join ───────────────────────────────────────────────────────────

const DEPLOY_OR_JOIN_QUESTION = `
You can do one of the following:
  1. Deploy a new NFT Trade Board contract
  2. Join an existing NFT Trade Board contract
  3. Exit
Which would you like to do? `;

const deployOrJoin = async (
  providers: NFTTradeProviders,
  rli: Interface,
  logger: Logger,
): Promise<NFTTradeAPI | null> => {
  while (true) {
    const choice = await rli.question(DEPLOY_OR_JOIN_QUESTION);
    switch (choice) {
      case '1': {
        const api = await NFTTradeAPI.deploy(providers, logger);
        logger.info(`Deployed contract at address: ${api.deployedContractAddress}`);
        return api;
      }
      case '2': {
        const addr = await rli.question('Contract address (hex): ');
        const api = await NFTTradeAPI.join(providers, addr, logger);
        logger.info(`Joined contract at address: ${api.deployedContractAddress}`);
        return api;
      }
      case '3':
        return null;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

// ─── Display helpers ─────────────────────────────────────────────────────────

const displayState = (state: NFTTradeDerivedState | undefined, logger: Logger): void => {
  if (!state) {
    logger.info('No state available yet');
    return;
  }
  logger.info(`Your public key (pseudonymous): ${state.myPublicKey}`);
  logger.info(`Your NFTs: ${state.myNFTs.length === 0 ? '(none)' : state.myNFTs.join(', ')}`);
  logger.info(`Total offers on board: ${state.offers.length}`);
  for (const o of state.offers) {
    const mine = o.isMyOffer ? ' [YOURS]' : '';
    logger.info(
      `  Offer ${o.offerId.slice(0, 12)}…  NFT #${o.nftOffered} → NFT #${o.nftRequested}  [${statusLabel(o.status)}]${mine}`,
    );
  }
};

// ─── Main interactive loop ────────────────────────────────────────────────────

const MAIN_LOOP_QUESTION = `
NFT Trade Board — choose an action:
  1. Mint an NFT (register ownership)
  2. Create a trade offer
  3. Accept an offer (you are the offeree)
  4. Reject an offer (you are the offeree)
  5. Cancel your offer
  6. Display current board state
  7. Show my public key (share with potential trade partners)
  8. Exit
Which would you like to do? `;

const mainLoop = async (providers: NFTTradeProviders, rli: Interface, logger: Logger): Promise<void> => {
  const api = await deployOrJoin(providers, rli, logger);
  if (api === null) return;

  let currentState: NFTTradeDerivedState | undefined;
  const sub = api.state$.subscribe({ next: (s) => (currentState = s) });

  try {
    while (true) {
      const choice = await rli.question(MAIN_LOOP_QUESTION);
      switch (choice) {
        // ── 1. Mint ──────────────────────────────────────────────────────────
        case '1': {
          const idStr = await rli.question('NFT token ID (number): ');
          const nftId = BigInt(idStr.trim());
          await api.mintNFT(nftId);
          logger.info(`Minted NFT #${nftId}`);
          break;
        }

        // ── 2. Create offer ──────────────────────────────────────────────────
        case '2': {
          const offeredStr  = await rli.question('NFT ID you are offering: ');
          const requestedStr = await rli.question('NFT ID you want in return: ');
          const offereePkHex = await rli.question("Offeree's public key (hex, share via secure channel): ");

          const salt = randomBytes(32);
          const offereePk = hexToBytes(offereePkHex.trim());
          const commitment = api.computeOffereeCommitment(offereePk, salt);

          const offerId = await api.createOffer(BigInt(offeredStr.trim()), BigInt(requestedStr.trim()), commitment);

          logger.info('--- Share these privately with the offeree (e.g. encrypted DM) ---');
          logger.info(`Offer ID : ${offerId}`);
          logger.info(`Salt     : ${toHex(salt)}`);
          logger.info('-------------------------------------------------------------------');
          break;
        }

        // ── 3. Accept ────────────────────────────────────────────────────────
        case '3': {
          const offerIdHex = await rli.question('Offer ID (hex, from offerer): ');
          const saltHex    = await rli.question('Salt (hex, from offerer): ');
          await api.acceptOffer(hexToBytes(offerIdHex.trim()), hexToBytes(saltHex.trim()));
          logger.info('Offer accepted — NFTs swapped!');
          break;
        }

        // ── 4. Reject ────────────────────────────────────────────────────────
        case '4': {
          const offerIdHex = await rli.question('Offer ID (hex, from offerer): ');
          const saltHex    = await rli.question('Salt (hex, from offerer): ');
          await api.rejectOffer(hexToBytes(offerIdHex.trim()), hexToBytes(saltHex.trim()));
          logger.info('Offer rejected.');
          break;
        }

        // ── 5. Cancel ────────────────────────────────────────────────────────
        case '5': {
          const offerIdHex = await rli.question('Offer ID to cancel (hex): ');
          await api.cancelOffer(hexToBytes(offerIdHex.trim()));
          logger.info('Offer cancelled.');
          break;
        }

        // ── 6. Display state ─────────────────────────────────────────────────
        case '6':
          displayState(currentState, logger);
          break;

        // ── 7. Show my public key ────────────────────────────────────────────
        case '7':
          if (currentState) {
            logger.info(`Your pseudonymous public key: ${currentState.myPublicKey}`);
            logger.info('(Share this with anyone who wants to send you a trade offer)');
          } else {
            logger.info('State not yet available — please wait a moment and try again.');
          }
          break;

        // ── 8. Exit ──────────────────────────────────────────────────────────
        case '8':
          logger.info('Exiting...');
          return;

        default:
          logger.error(`Invalid choice: ${choice}`);
      }
    }
  } finally {
    sub.unsubscribe();
  }
};

// ─── Wallet / startup ────────────────────────────────────────────────────────

const GENESIS_MINT_WALLET_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

const WALLET_LOOP_QUESTION = `
  1. Build a fresh wallet
  2. Build wallet from a seed
  3. Exit
Which would you like to do? `;

const buildWallet = async (config: Config, rli: Interface, logger: Logger): Promise<string | undefined> => {
  if (config instanceof StandaloneConfig) return GENESIS_MINT_WALLET_SEED;
  while (true) {
    const choice = await rli.question(WALLET_LOOP_QUESTION);
    switch (choice) {
      case '1': return toHex(randomBytes(32));
      case '2': return await rli.question('Enter your wallet seed: ');
      case '3': return undefined;
      default: logger.error(`Invalid choice: ${choice}`);
    }
  }
};

export const run = async (config: Config, testEnv: TestEnvironment, logger: Logger): Promise<void> => {
  const rli = createInterface({ input, output, terminal: true });
  const providersToBeStopped: MidnightWalletProvider[] = [];
  try {
    const envConfiguration = await testEnv.start();
    logger.info(`Environment started: ${JSON.stringify(envConfiguration)}`);

    const seed = await buildWallet(config, rli, logger);
    if (seed === undefined) return;

    const walletProvider = await MidnightWalletProvider.build(logger, envConfiguration, seed);
    providersToBeStopped.push(walletProvider);
    const walletFacade: WalletFacade = walletProvider.wallet;
    await walletProvider.start();

    const unshieldedState = await waitForUnshieldedFunds(
      logger, walletFacade, envConfiguration, unshieldedToken(), config.requestFaucetTokens,
    );
    const nightBalance = unshieldedState.balances[unshieldedToken().raw];
    if (nightBalance === undefined) { logger.info('No funds received, exiting...'); return; }
    logger.info(`Your NIGHT balance: ${nightBalance}`);

    if (config.generateDust) {
      const dustGeneration = await generateDust(logger, seed, unshieldedState, walletFacade);
      if (dustGeneration) {
        logger.info(`Submitted dust generation tx: ${dustGeneration}`);
        await syncWallet(logger, walletFacade);
      }
    }

    const zkConfigProvider = new NodeZkConfigProvider<NFTTradeCircuitKeys>(config.zkConfigPath);
    const providers: NFTTradeProviders = {
      privateStateProvider: levelPrivateStateProvider<PrivateStateId, NFTTradePrivateState>({
        privateStateStoreName: config.privateStateStoreName,
        signingKeyStoreName: `${config.privateStateStoreName}-signing-keys`,
        privateStoragePasswordProvider: () => 'key-just-for-testing-here!',
      }),
      publicDataProvider: indexerPublicDataProvider(envConfiguration.indexer, envConfiguration.indexerWS),
      zkConfigProvider,
      proofProvider: httpClientProofProvider(envConfiguration.proofServer, zkConfigProvider),
      walletProvider,
      midnightProvider: walletProvider,
    };

    await mainLoop(providers, rli, logger);
  } catch (e) {
    logError(logger, e);
    logger.info('Exiting...');
  } finally {
    try { rli.close(); rli.removeAllListeners(); } catch (e) { logError(logger, e); }
    try {
      for (const w of providersToBeStopped) { logger.info('Stopping wallet...'); await w.stop(); }
      if (testEnv) { logger.info('Stopping test environment...'); await testEnv.shutdown(); }
    } catch (e) { logError(logger, e); }
  }
};

type NFTTradeCircuitKeys = 'mintNFT' | 'createOffer' | 'acceptOffer' | 'cancelOffer' | 'rejectOffer';

function logError(logger: Logger, e: unknown): void {
  if (e instanceof Error) {
    logger.error(`Error: ${e.message}`);
    logger.debug(e.stack ?? '');
  } else {
    logger.error('Unknown error');
  }
}
