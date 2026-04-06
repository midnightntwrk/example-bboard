// capstone/dan-laduke — NFT Trade Offer Board
// SPDX-License-Identifier: Apache-2.0

/*
 * Private state and witness definitions for the NFT Trade Offer contract.
 *
 * The only hidden state is the user's secret key — the same pattern as the
 * original bulletin board. This single 32-byte key drives everything:
 *   • userPublicKey(sk) → pseudonymous offerer/offeree identity
 *   • offereeCommitment(pk, salt) → opaque commitment hiding the offeree
 *
 * No salt witness is needed because the salt is passed as a plain circuit
 * parameter by the caller — it only stays private because the ZK proof
 * proves the equation holds without revealing the salt on-chain.
 */

import { type Ledger } from './managed/nft-trade/contract/index.js';
import { type WitnessContext } from '@midnight-ntwrk/compact-runtime';

export type NFTTradePrivateState = {
  readonly secretKey: Uint8Array;
};

export const createNFTTradePrivateState = (secretKey: Uint8Array): NFTTradePrivateState => ({
  secretKey,
});

export const witnesses = {
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, NFTTradePrivateState>): [NFTTradePrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],
};
