// capstone/dan-laduke — NFT Trade Offer Tests
// SPDX-License-Identifier: Apache-2.0

/*
 * Simulator tests for the NFT Trade Offer contract.
 *
 * Every new circuit has at least two tests: a success case and a failure case.
 * Tests run entirely in the Midnight simulator — no proof server required.
 *
 * Test structure:
 *   mintNFT          — happy path + double-mint rejection
 *   createOffer      — happy path + ownership check
 *   acceptOffer      — full swap + wrong-recipient rejection + non-pending rejection
 *   cancelOffer      — offerer cancels + non-offerer rejection
 *   rejectOffer      — offeree rejects + wrong-recipient rejection
 *   multi-user flow  — two users with simultaneous offers
 *   double-accept    — second accept on settled offer fails
 */

import { NFTTradeSimulator, OfferStatus } from './nft-trade-simulator.js';
import { NetworkId, setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { describe, it, expect } from 'vitest';
import { randomBytes } from './utils.js';

setNetworkId('undeployed' as NetworkId);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toHex = (b: Uint8Array) => Buffer.from(b).toString('hex');

/**
 * Set up a two-user scenario.
 * Alice has NFT #1; Bob has NFT #2.
 * Returns alice's simulator, bob's secret key, bob's public key, and a salt.
 */
function setupAliceAndBob() {
  const aliceKey = randomBytes(32);
  const bobKey   = randomBytes(32);
  const sim      = new NFTTradeSimulator(aliceKey);

  // Mint Alice's NFT as Alice
  sim.mintNFT(1n);

  // Switch to Bob and mint his NFT
  sim.switchUser(bobKey);
  sim.mintNFT(2n);
  const bobPk = sim.myPublicKey();

  // Switch back to Alice for the offer
  sim.switchUser(aliceKey);

  const salt = randomBytes(32);
  const commitment = sim.computeCommitment(bobPk, salt);

  return { sim, aliceKey, bobKey, bobPk, salt, commitment };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('NFT Trade Offer Board', () => {
  // ── mintNFT ─────────────────────────────────────────────────────────────────

  describe('mintNFT', () => {
    it('assigns NFT ownership to the minting user', () => {
      const sim = new NFTTradeSimulator(randomBytes(32));
      sim.mintNFT(42n);
      expect(toHex(sim.ownerOf(42n)!)).toEqual(toHex(sim.myPublicKey()));
    });

    it('rejects minting an already-minted NFT', () => {
      const sim = new NFTTradeSimulator(randomBytes(32));
      sim.mintNFT(7n);
      expect(() => sim.mintNFT(7n)).toThrow('failed assert: NFT already minted');
    });

    it('allows two different users to mint different NFTs', () => {
      const aliceKey = randomBytes(32);
      const bobKey   = randomBytes(32);
      const sim      = new NFTTradeSimulator(aliceKey);
      sim.mintNFT(1n);
      sim.switchUser(bobKey);
      sim.mintNFT(2n);
      // Both exist in the ledger, owned by their respective minters
      expect(sim.ownerOf(1n)).toBeDefined();
      expect(sim.ownerOf(2n)).toBeDefined();
      expect(toHex(sim.ownerOf(1n)!)).not.toEqual(toHex(sim.ownerOf(2n)!));
    });
  });

  // ── createOffer ──────────────────────────────────────────────────────────────

  describe('createOffer', () => {
    it('creates a pending offer and returns an offer ID', () => {
      const { sim, bobPk, salt, commitment } = setupAliceAndBob();
      const offerId = sim.createOffer(1n, 2n, commitment);
      expect(sim.offerStatus(offerId)).toEqual(OfferStatus.PENDING);
    });

    it('rejects creating an offer for an NFT you do not own', () => {
      const sim = new NFTTradeSimulator(randomBytes(32));
      // Alice does NOT own NFT #99
      const fakePk = randomBytes(32);
      const salt   = randomBytes(32);
      const commitment = sim.computeCommitment(fakePk, salt);
      expect(() => sim.createOffer(99n, 2n, commitment)).toThrow('failed assert: Offered NFT does not exist');
    });

    it('rejects creating an offer for an NFT owned by someone else', () => {
      const aliceKey = randomBytes(32);
      const bobKey   = randomBytes(32);
      const sim      = new NFTTradeSimulator(aliceKey);
      // Bob mints NFT #5; Alice tries to offer it
      sim.switchUser(bobKey);
      sim.mintNFT(5n);
      sim.switchUser(aliceKey);
      const commitment = sim.computeCommitment(randomBytes(32), randomBytes(32));
      expect(() => sim.createOffer(5n, 2n, commitment)).toThrow(
        "failed assert: Caller does not own the offered NFT",
      );
    });

    it('increments offer_count for each new offer', () => {
      const { sim, commitment } = setupAliceAndBob();
      const before = sim.getLedger().offer_count;
      sim.createOffer(1n, 2n, commitment);
      expect(sim.getLedger().offer_count).toEqual(before + 1n);
    });
  });

  // ── acceptOffer ──────────────────────────────────────────────────────────────

  describe('acceptOffer', () => {
    it('swaps NFT ownership on successful accept', () => {
      const { sim, aliceKey, bobKey, bobPk, salt, commitment } = setupAliceAndBob();
      const alicePk = sim.myPublicKey();

      const offerId = sim.createOffer(1n, 2n, commitment);

      // Bob accepts
      sim.switchUser(bobKey);
      sim.acceptOffer(offerId, salt);

      // NFT #1 now owned by Bob; NFT #2 now owned by Alice
      expect(toHex(sim.ownerOf(1n)!)).toEqual(toHex(bobPk));
      expect(toHex(sim.ownerOf(2n)!)).toEqual(toHex(alicePk));
      expect(sim.offerStatus(offerId)).toEqual(OfferStatus.ACCEPTED);
    });

    it('rejects accept with wrong salt (third party cannot claim the offer)', () => {
      const { sim, aliceKey, bobKey, commitment } = setupAliceAndBob();
      const offerId  = sim.createOffer(1n, 2n, commitment);
      const wrongSalt = randomBytes(32); // Carol guesses a different salt

      // Carol (a random user) tries to accept with wrong salt
      sim.switchUser(randomBytes(32));
      expect(() => sim.acceptOffer(offerId, wrongSalt)).toThrow(
        'failed assert: Caller is not the intended recipient',
      );
    });

    it('rejects accept when offeree does not own the requested NFT', () => {
      // Alice offers NFT #1 for NFT #2, but Bob hasn't minted #2 yet
      const aliceKey = randomBytes(32);
      const bobKey   = randomBytes(32);
      const sim      = new NFTTradeSimulator(aliceKey);
      sim.mintNFT(1n);
      sim.switchUser(bobKey);
      const bobPk = sim.myPublicKey();
      sim.switchUser(aliceKey);

      const salt       = randomBytes(32);
      const commitment = sim.computeCommitment(bobPk, salt);
      const offerId    = sim.createOffer(1n, 2n, commitment); // Bob doesn't have #2

      sim.switchUser(bobKey);
      expect(() => sim.acceptOffer(offerId, salt)).toThrow(
        'failed assert: Offeree does not own the requested NFT',
      );
    });

    it('rejects accept on a non-existent offer', () => {
      const sim  = new NFTTradeSimulator(randomBytes(32));
      const fake = randomBytes(32);
      expect(() => sim.acceptOffer(fake, randomBytes(32))).toThrow(
        'failed assert: Offer does not exist',
      );
    });
  });

  // ── cancelOffer ──────────────────────────────────────────────────────────────

  describe('cancelOffer', () => {
    it('lets the offerer cancel a pending offer', () => {
      const { sim, commitment } = setupAliceAndBob();
      const offerId = sim.createOffer(1n, 2n, commitment);
      sim.cancelOffer(offerId);
      expect(sim.offerStatus(offerId)).toEqual(OfferStatus.CANCELLED);
    });

    it('does not let a non-offerer cancel the offer', () => {
      const { sim, aliceKey, bobKey, commitment } = setupAliceAndBob();
      const offerId = sim.createOffer(1n, 2n, commitment);

      // Bob (the offeree) attempts to cancel Alice's offer
      sim.switchUser(bobKey);
      expect(() => sim.cancelOffer(offerId)).toThrow(
        'failed assert: Caller is not the offer creator',
      );
    });

    it('does not let the offerer cancel an already-accepted offer', () => {
      const { sim, aliceKey, bobKey, salt, commitment } = setupAliceAndBob();
      const offerId = sim.createOffer(1n, 2n, commitment);
      sim.switchUser(bobKey);
      sim.acceptOffer(offerId, salt);     // Bob accepts first
      sim.switchUser(aliceKey);
      expect(() => sim.cancelOffer(offerId)).toThrow('failed assert: Offer is not pending');
    });
  });

  // ── rejectOffer ──────────────────────────────────────────────────────────────

  describe('rejectOffer', () => {
    it('lets the offeree reject a pending offer', () => {
      const { sim, bobKey, salt, commitment } = setupAliceAndBob();
      const offerId = sim.createOffer(1n, 2n, commitment);
      sim.switchUser(bobKey);
      sim.rejectOffer(offerId, salt);
      expect(sim.offerStatus(offerId)).toEqual(OfferStatus.REJECTED);
    });

    it('does not transfer NFTs when an offer is rejected', () => {
      const { sim, aliceKey, bobKey, bobPk, salt, commitment } = setupAliceAndBob();
      const alicePk = sim.myPublicKey();
      const offerId = sim.createOffer(1n, 2n, commitment);
      sim.switchUser(bobKey);
      sim.rejectOffer(offerId, salt);
      // Ownership unchanged
      expect(toHex(sim.ownerOf(1n)!)).toEqual(toHex(alicePk));
      expect(toHex(sim.ownerOf(2n)!)).toEqual(toHex(bobPk));
    });

    it('does not let a third party reject the offer with the wrong salt', () => {
      const { sim, commitment } = setupAliceAndBob();
      const offerId = sim.createOffer(1n, 2n, commitment);
      // Carol tries to reject with a random salt
      sim.switchUser(randomBytes(32));
      expect(() => sim.rejectOffer(offerId, randomBytes(32))).toThrow(
        'failed assert: Caller is not the intended recipient',
      );
    });
  });

  // ── double-accept ────────────────────────────────────────────────────────────

  describe('double-accept prevention', () => {
    it('rejects a second accept on an already-accepted offer', () => {
      const { sim, aliceKey, bobKey, salt, commitment } = setupAliceAndBob();
      const offerId = sim.createOffer(1n, 2n, commitment);
      sim.switchUser(bobKey);
      sim.acceptOffer(offerId, salt);
      // Bob tries to accept again
      expect(() => sim.acceptOffer(offerId, salt)).toThrow('failed assert: Offer is not pending');
    });

    it('rejects accepting a cancelled offer', () => {
      const { sim, aliceKey, bobKey, salt, commitment } = setupAliceAndBob();
      const offerId = sim.createOffer(1n, 2n, commitment);
      sim.cancelOffer(offerId);
      sim.switchUser(bobKey);
      expect(() => sim.acceptOffer(offerId, salt)).toThrow('failed assert: Offer is not pending');
    });
  });

  // ── multi-user simultaneous offers ───────────────────────────────────────────

  describe('multi-user simultaneous offers', () => {
    it('supports multiple pending offers at the same time', () => {
      const aliceKey = randomBytes(32);
      const bobKey   = randomBytes(32);
      const carolKey = randomBytes(32);
      const sim      = new NFTTradeSimulator(aliceKey);

      // Mint NFTs
      sim.mintNFT(10n);
      sim.switchUser(bobKey);
      sim.mintNFT(11n);
      sim.switchUser(carolKey);
      sim.mintNFT(12n);

      // Alice offers #10 for #11 (to Bob)
      sim.switchUser(aliceKey);
      const bobPk      = (() => { sim.switchUser(bobKey); const pk = sim.myPublicKey(); sim.switchUser(aliceKey); return pk; })();
      const saltAB     = randomBytes(32);
      const commitAB   = sim.computeCommitment(bobPk, saltAB);
      const offerIdAB  = sim.createOffer(10n, 11n, commitAB);

      // Bob offers #11 for #12 (to Carol)
      sim.switchUser(bobKey);
      const carolPk    = (() => { sim.switchUser(carolKey); const pk = sim.myPublicKey(); sim.switchUser(bobKey); return pk; })();
      const saltBC     = randomBytes(32);
      const commitBC   = sim.computeCommitment(carolPk, saltBC);
      const offerIdBC  = sim.createOffer(11n, 12n, commitBC);

      // Both offers are independently pending
      expect(sim.offerStatus(offerIdAB)).toEqual(OfferStatus.PENDING);
      expect(sim.offerStatus(offerIdBC)).toEqual(OfferStatus.PENDING);

      // Bob accepts Alice's offer
      sim.switchUser(bobKey);
      sim.acceptOffer(offerIdAB, saltAB);
      expect(sim.offerStatus(offerIdAB)).toEqual(OfferStatus.ACCEPTED);
      // Bob's other offer is still pending
      expect(sim.offerStatus(offerIdBC)).toEqual(OfferStatus.PENDING);
    });

    it('each offer gets a unique ID even for the same parties and NFTs', () => {
      const { sim, commitment } = setupAliceAndBob();
      // Re-use same NFT after cancel to create two distinct offers
      const id1 = sim.createOffer(1n, 2n, commitment);
      sim.cancelOffer(id1);
      const id2 = sim.createOffer(1n, 2n, commitment);
      expect(toHex(id1)).not.toEqual(toHex(id2));
    });
  });

  // ── ledger initialization ────────────────────────────────────────────────────

  describe('initial state', () => {
    it('initializes offer_count to 1', () => {
      const sim = new NFTTradeSimulator(randomBytes(32));
      expect(sim.getLedger().offer_count).toEqual(1n);
    });

    it('produces deterministic offer_count for the same secret key', () => {
      const key = randomBytes(32);
      const sim0 = new NFTTradeSimulator(key);
      const sim1 = new NFTTradeSimulator(key);
      // Both should initialize offer_count to 1 deterministically
      expect(sim0.getLedger().offer_count).toEqual(sim1.getLedger().offer_count);
      expect(sim0.getLedger().offer_count).toEqual(1n);
    });
  });
});
