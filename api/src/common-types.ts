// capstone/dan-laduke — NFT Trade Offer Board
// SPDX-License-Identifier: Apache-2.0

/**
 * NFT Trade Offer common types and abstractions.
 *
 * @module
 */

import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { OfferStatus, Contract, Witnesses } from '../../contract/src/index';
import type { NFTTradePrivateState } from '../../contract/src/witnesses';

export const nftTradePrivateStateKey = 'nftTradePrivateState';
export type PrivateStateId = typeof nftTradePrivateStateKey;

/**
 * The private states consumed throughout the application.
 */
export type PrivateStates = {
  readonly nftTradePrivateState: NFTTradePrivateState;
};

/**
 * Represents the deployed NFT trade contract and its private state.
 */
export type NFTTradeContract = Contract<NFTTradePrivateState, Witnesses<NFTTradePrivateState>>;

/**
 * The keys of the circuits exported from {@link NFTTradeContract}.
 */
export type NFTTradeCircuitKeys = Exclude<keyof NFTTradeContract['impureCircuits'], number | symbol>;

/**
 * The providers required by the NFT trade contract.
 */
export type NFTTradeProviders = MidnightProviders<NFTTradeCircuitKeys, PrivateStateId, NFTTradePrivateState>;

/**
 * A deployed NFT trade contract.
 */
export type DeployedNFTTradeContract = FoundContract<NFTTradeContract>;

/**
 * An offer as it appears in derived state: ledger fields combined with
 * locally-derived knowledge of who created it and whether it's for us.
 */
export type OfferView = {
  readonly offerId: string;            // hex-encoded offer_id
  readonly offererPk: string;          // hex-encoded pseudonymous offerer key
  readonly offereeCommitment: string;  // hex-encoded opaque commitment
  readonly nftOffered: bigint;
  readonly nftRequested: bigint;
  readonly status: OfferStatus;
  readonly isMyOffer: boolean;         // true if the local user created this offer
};

/**
 * Full derived state exposed to the CLI and UI.
 */
export type NFTTradeDerivedState = {
  readonly myPublicKey: string;          // hex-encoded local user's derived key
  readonly myNFTs: bigint[];             // NFT IDs owned by the local user
  readonly offers: OfferView[];          // all known offers
};
