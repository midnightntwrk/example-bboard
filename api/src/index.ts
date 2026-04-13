// capstone/dan-laduke — NFT Trade Offer Board
// SPDX-License-Identifier: Apache-2.0

/**
 * Provides types and utilities for working with the NFT Trade Offer contract.
 *
 * @packageDocumentation
 */

import * as NFTTrade from '../../contract/src/managed/nft-trade/contract/index.js';

import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import { type Logger } from 'pino';
import {
  type NFTTradeDerivedState,
  type NFTTradeContract,
  type NFTTradeProviders,
  type DeployedNFTTradeContract,
  type OfferView,
  nftTradePrivateStateKey,
} from './common-types.js';
import { CompiledNFTTradeContractContract } from '../../contract/src/index';
import * as utils from './utils/index.js';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { combineLatest, map, tap, from, type Observable } from 'rxjs';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { NFTTradePrivateState, createNFTTradePrivateState } from '@midnight-ntwrk/bboard-contract';

/**
 * An API for a deployed NFT Trade Offer Board.
 */
export interface DeployedNFTTradeAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<NFTTradeDerivedState>;

  mintNFT: (nftId: bigint) => Promise<void>;
  createOffer: (nftOffered: bigint, nftRequested: bigint, offereeCommitment: Uint8Array) => Promise<string>;
  acceptOffer: (offerId: Uint8Array, salt: Uint8Array) => Promise<void>;
  cancelOffer: (offerId: Uint8Array) => Promise<void>;
  rejectOffer: (offerId: Uint8Array, salt: Uint8Array) => Promise<void>;

  /** Off-chain helper: compute an offeree commitment from their public key + a salt. */
  computeOffereeCommitment: (offereePk: Uint8Array, salt: Uint8Array) => Uint8Array;
}

/**
 * Adapts a deployed NFT trade contract into a high-level API.
 */
export class NFTTradeAPI implements DeployedNFTTradeAPI {
  private constructor(
    public readonly deployedContract: DeployedNFTTradeContract,
    providers: NFTTradeProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;

    this.state$ = combineLatest(
      [
        providers.publicDataProvider
          .contractStateObservable(this.deployedContractAddress, { type: 'latest' })
          .pipe(
            map((contractState) => NFTTrade.ledger(contractState.data)),
            tap((ls) => logger?.trace({ ledgerStateChanged: { offerCount: ls.offer_count } })),
          ),
        from(
          providers.privateStateProvider.get(nftTradePrivateStateKey) as Promise<NFTTradePrivateState>,
        ),
      ],
      (ledgerState, privateState) => {
        const myPk = NFTTrade.pureCircuits.userPublicKey(privateState.secretKey);
        const myPkHex = toHex(myPk);

        // Collect all NFT IDs owned by this user
        const myNFTs: bigint[] = [];
        // Build offer views from the offer ledger maps
        const offers: OfferView[] = [];

        // The generated Ledger Map type supports [Symbol.iterator] — use for...of directly.
        for (const [offerIdBytes, offererPk] of ledgerState.offer_offerer_pk) {
          const offerIdHex = toHex(offerIdBytes);
          const offererPkHex = toHex(offererPk);
          const offereeCommit = ledgerState.offer_offeree_commit.lookup(offerIdBytes);
          const nftOffered = ledgerState.offer_nft_offered.lookup(offerIdBytes);
          const nftRequested = ledgerState.offer_nft_requested.lookup(offerIdBytes);
          const status = ledgerState.offer_status.lookup(offerIdBytes);

          offers.push({
            offerId: offerIdHex,
            offererPk: offererPkHex,
            offereeCommitment: toHex(offereeCommit),
            nftOffered,
            nftRequested,
            status,
            isMyOffer: offererPkHex === myPkHex,
          });
        }

        // Collect NFTs owned by local user from nft_owners map
        for (const [nftId, ownerPk] of ledgerState.nft_owners) {
          if (toHex(ownerPk) === myPkHex) {
            myNFTs.push(nftId);
          }
        }

        return {
          myPublicKey: myPkHex,
          myNFTs,
          offers,
        } satisfies NFTTradeDerivedState;
      },
    );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<NFTTradeDerivedState>;

  /** Mint a new NFT owned by the current user. */
  async mintNFT(nftId: bigint): Promise<void> {
    this.logger?.info({ mintNFT: nftId.toString() });
    const txData = await this.deployedContract.callTx.mintNFT(nftId);
    this.logger?.trace({ transactionAdded: { circuit: 'mintNFT', txHash: txData.public.txHash } });
  }

  /**
   * Create a trade offer.
   *
   * @param nftOffered     Token ID you are offering.
   * @param nftRequested   Token ID you want in return.
   * @param offereeCommitment  Commitment for the intended recipient — compute with
   *                           `computeOffereeCommitment(offereePk, salt)` before calling.
   * @returns Hex-encoded offer ID to share with the offeree alongside the salt.
   */
  async createOffer(nftOffered: bigint, nftRequested: bigint, offereeCommitment: Uint8Array): Promise<string> {
    this.logger?.info({ createOffer: { nftOffered: nftOffered.toString(), nftRequested: nftRequested.toString() } });
    const txData = await this.deployedContract.callTx.createOffer(nftOffered, nftRequested, offereeCommitment);
    this.logger?.trace({ transactionAdded: { circuit: 'createOffer', txHash: txData.public.txHash } });
    return toHex(txData.private.result as Uint8Array);
  }

  /** Accept a trade offer (executes the NFT swap). */
  async acceptOffer(offerId: Uint8Array, salt: Uint8Array): Promise<void> {
    this.logger?.info({ acceptOffer: toHex(offerId) });
    const txData = await this.deployedContract.callTx.acceptOffer(offerId, salt);
    this.logger?.trace({ transactionAdded: { circuit: 'acceptOffer', txHash: txData.public.txHash } });
  }

  /** Cancel your own pending offer. */
  async cancelOffer(offerId: Uint8Array): Promise<void> {
    this.logger?.info({ cancelOffer: toHex(offerId) });
    const txData = await this.deployedContract.callTx.cancelOffer(offerId);
    this.logger?.trace({ transactionAdded: { circuit: 'cancelOffer', txHash: txData.public.txHash } });
  }

  /** Decline an offer addressed to you. */
  async rejectOffer(offerId: Uint8Array, salt: Uint8Array): Promise<void> {
    this.logger?.info({ rejectOffer: toHex(offerId) });
    const txData = await this.deployedContract.callTx.rejectOffer(offerId, salt);
    this.logger?.trace({ transactionAdded: { circuit: 'rejectOffer', txHash: txData.public.txHash } });
  }

  /**
   * Off-chain helper: compute the commitment to share with an offeree.
   * Call pureCircuits.offereeCommitment on the compiled contract.
   */
  computeOffereeCommitment(offereePk: Uint8Array, salt: Uint8Array): Uint8Array {
    return NFTTrade.pureCircuits.offereeCommitment(offereePk, salt);
  }

  static async deploy(providers: NFTTradeProviders, secretKey: Uint8Array, logger?: Logger): Promise<NFTTradeAPI> {
    logger?.info('deployContract');
    const deployedContract = await deployContract(providers, {
      compiledContract: CompiledNFTTradeContractContract,
      privateStateId: nftTradePrivateStateKey,
      initialPrivateState: await NFTTradeAPI.getPrivateState(providers, secretKey),
    });
    logger?.trace({ contractDeployed: { finalizedDeployTxData: deployedContract.deployTxData.public } });
    return new NFTTradeAPI(deployedContract, providers, logger);
  }

  static async join(
    providers: NFTTradeProviders,
    contractAddress: ContractAddress,
    secretKey: Uint8Array,
    logger?: Logger,
  ): Promise<NFTTradeAPI> {
    logger?.info({ joinContract: { contractAddress } });
    const deployedContract = await findDeployedContract<NFTTradeContract>(providers, {
      contractAddress,
      compiledContract: CompiledNFTTradeContractContract,
      privateStateId: nftTradePrivateStateKey,
      initialPrivateState: await NFTTradeAPI.getPrivateState(providers, secretKey),
    });
    logger?.trace({ contractJoined: { finalizedDeployTxData: deployedContract.deployTxData.public } });
    return new NFTTradeAPI(deployedContract, providers, logger);
  }

  private static async getPrivateState(providers: NFTTradeProviders, secretKey: Uint8Array): Promise<NFTTradePrivateState> {
    const existing = await providers.privateStateProvider.get(nftTradePrivateStateKey);
    return existing ?? createNFTTradePrivateState(secretKey);
  }
}

export * as utils from './utils/index.js';
export * from './common-types.js';
