// capstone/dan-laduke — NFT Trade Offer Simulator
// SPDX-License-Identifier: Apache-2.0

/*
 * Simulator for the NFT Trade Offer contract.
 *
 * Mirrors the pattern of bboard-simulator.ts: wraps the compiled contract's
 * impureCircuits and pureCircuits into convenience methods suitable for tests.
 * Everything runs in the Midnight simulator — no proof server, no network.
 */

import {
  type CircuitContext,
  QueryContext,
  dummyContractAddress,
  createConstructorContext,
  CostModel,
} from '@midnight-ntwrk/compact-runtime';
import {
  Contract,
  type Ledger,
  ledger,
  pureCircuits,
  OfferStatus,
} from '../managed/nft-trade/contract/index.js';
import { type NFTTradePrivateState, witnesses } from '../witnesses.js';

export { OfferStatus };

/**
 * Wraps the NFT Trade contract for easy use in simulator tests.
 *
 * Call `switchUser(newKey)` to simulate a different user in the same ledger.
 */
export class NFTTradeSimulator {
  readonly contract: Contract<NFTTradePrivateState>;
  circuitContext: CircuitContext<NFTTradePrivateState>;

  constructor(secretKey: Uint8Array) {
    this.contract = new Contract<NFTTradePrivateState>(witnesses);
    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(createConstructorContext({ secretKey }, '0'.repeat(64)));

    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(currentContractState.data, dummyContractAddress()),
    };
  }

  /** Switch the active user (changes the secret key in private state). */
  public switchUser(secretKey: Uint8Array): void {
    this.circuitContext.currentPrivateState = { secretKey };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): NFTTradePrivateState {
    return this.circuitContext.currentPrivateState;
  }

  /** Returns the current user's pseudonymous public key. */
  public myPublicKey(): Uint8Array {
    return this.contract.circuits.userPublicKey(
      this.circuitContext,
      this.getPrivateState().secretKey,
    ).result;
  }

  /**
   * Compute an offeree commitment off-chain (same as pureCircuits.offereeCommitment).
   * The offerer calls this, then shares (offerId, salt) secretly with the offeree.
   */
  public computeCommitment(offereePk: Uint8Array, salt: Uint8Array): Uint8Array {
    return this.contract.circuits.offereeCommitment(this.circuitContext, offereePk, salt).result;
  }

  /** Mint an NFT owned by the current user. */
  public mintNFT(nftId: bigint): Ledger {
    this.circuitContext = this.contract.impureCircuits.mintNFT(this.circuitContext, nftId).context;
    return this.getLedger();
  }

  /**
   * Create a trade offer.
   *
   * @returns The offer_id as a Uint8Array.
   */
  public createOffer(
    nftOffered: bigint,
    nftRequested: bigint,
    offereeCommitment: Uint8Array,
  ): Uint8Array {
    const result = this.contract.impureCircuits.createOffer(
      this.circuitContext,
      nftOffered,
      nftRequested,
      offereeCommitment,
    );
    this.circuitContext = result.context;
    return result.result as Uint8Array;
  }

  /** Accept a pending offer (caller must be the intended offeree). */
  public acceptOffer(offerId: Uint8Array, salt: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.acceptOffer(
      this.circuitContext,
      offerId,
      salt,
    ).context;
    return this.getLedger();
  }

  /** Cancel a pending offer (caller must be the offerer). */
  public cancelOffer(offerId: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.cancelOffer(
      this.circuitContext,
      offerId,
    ).context;
    return this.getLedger();
  }

  /** Reject a pending offer (caller must be the intended offeree). */
  public rejectOffer(offerId: Uint8Array, salt: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.rejectOffer(
      this.circuitContext,
      offerId,
      salt,
    ).context;
    return this.getLedger();
  }

  /** Read the owner of an NFT from the ledger (undefined if not minted). */
  public ownerOf(nftId: bigint): Uint8Array | undefined {
    const l = this.getLedger();
    return l.nft_owners.member(nftId) ? (l.nft_owners.lookup(nftId) as Uint8Array) : undefined;
  }

  /** Read the status of an offer (undefined if it doesn't exist). */
  public offerStatus(offerId: Uint8Array): OfferStatus | undefined {
    const l = this.getLedger();
    return l.offer_status.member(offerId) ? (l.offer_status.lookup(offerId) as OfferStatus) : undefined;
  }
}
