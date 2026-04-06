# NFT Trade Offer Board — Midnight Capstone (Track D)

**Author:** Dan Laduke
**Branch:** `capstone/dan-laduke`

---

## What I Built

This project extends the Midnight bulletin board example into a **private peer-to-peer NFT trade offer system**. Users can propose NFT swaps addressed to a specific counterparty, with the intended recipient's identity hidden on-chain behind a cryptographic commitment. Only the offerer and offeree can know who the trade is addressed to; anyone else sees only the offer terms (which NFT IDs are being exchanged) and an opaque blob where the recipient identifier should be.

### Circuits

| Circuit | Purpose |
|---|---|
| `mintNFT(nft_id)` | Register NFT ownership; the caller becomes the owner |
| `createOffer(nft_offered, nft_requested, offeree_commitment)` | Post a trade offer addressed to a hidden recipient; returns `offer_id` |
| `acceptOffer(offer_id, salt)` | Prove you're the intended offeree and execute the swap |
| `cancelOffer(offer_id)` | Offerer cancels a pending offer |
| `rejectOffer(offer_id, salt)` | Offeree declines without executing the swap |

### Privacy Model

| Data | Visibility |
|---|---|
| NFT IDs being traded | **Public** — visible on the ledger |
| Offerer identity | **Pseudonymous** — stored as a derived public key; cannot be linked to a wallet without the secret key |
| Offeree identity | **Hidden** — stored as `hash(offeree_pk || salt)`; a ZK proof verifies the recipient without revealing them |
| The salt | **Private** — never appears on-chain; shared off-chain (e.g. via encrypted DM) |

---

## Design Decisions

### Why an Offeree Commitment Instead of Encrypting the Identity

I considered encrypting the offeree's public key with the offerer's key, but Compact doesn't yet have asymmetric encryption primitives. The commitment scheme (using `persistentHash`) achieves the same goal: the offerer computes `hash(offeree_pk || salt)` off-chain and stores the result. When the offeree calls `acceptOffer` or `rejectOffer`, they provide the salt inside a ZK circuit. The circuit verifies the hash equation holds without ever disclosing the salt or their derived public key to the ledger.

This mirrors the bboard's ownership proof pattern but inverted: instead of *publishing* the public key to prove you own a post (bboard), you *hide* the public key behind a commitment to prove you're the intended recipient (this contract).

### Why Separate Maps Instead of a Struct in One Map

Compact's `Map<K, V>` type can hold any value type, including structs. However, each circuit only needs to update one field of an offer record (e.g., `cancelOffer` only writes `offer_status`). Using separate maps (`offer_offerer_pk`, `offer_offeree_commit`, etc.) makes each field's update independent, which avoids needing to read-modify-write the entire struct when only one field changes. The trade-off is more ledger map declarations — acceptable at this scale.

### Why No External NFT Library

The research phase revealed that Midnight does **not yet support contract-to-contract calls from within circuits**. External NFT modules (`riusricardo/midnight-contracts`, OpenZeppelin Compact) require their circuits to be invoked from ours — which is explicitly unsupported on testnet as of this writing. Instead, this contract manages NFT ownership internally via `ledger nft_owners: Map<Uint<128>, Bytes<32>>`, mapping token IDs to owner derived public keys. This is self-contained and demonstrates the same ownership patterns without an unresolvable dependency.

### Why `userPublicKey` Doesn't Use a Sequence Number

The bboard contract rotates the public key on each `takeDown` using a `sequence` counter, so the next poster gets a fresh identity. In a trade offer system, stability is more useful: the offeree needs to know the offerer's key in advance to send offers, and the offerer needs a stable key to receive them. A rotating key would break the ability to reference a user across multiple offers.

---

## Compact Patterns Applied

**`witness`:** The single `localSecretKey()` witness provides the user's secret key to circuits. It never appears on-chain — only values derived from it (via `persistentHash`) are stored or compared. The witness pattern is unchanged from bboard: one 32-byte secret drives all identity operations.

**`disclose()`:** Every value derived from a witness that must be written to the public ledger is wrapped with `disclose()`. The Compact compiler enforces this — code that writes witness-derived data without `disclose()` does not compile. In this contract, `disclose()` appears on the NFT owner key write, each offer field write, and the offer ID write. The `offereeCommitment` value passed *in* by the caller is already a circuit parameter (not a witness result), so it needs `disclose()` only at the point where it's stored.

**`persistentHash`:** Used in two places: `userPublicKey(sk)` derives a domain-separated pseudonymous identity, and `offereeCommitment(pk, salt)` creates the opaque recipient commitment. The domain prefix `"nft-trade:pk:"` prevents key reuse across different applications. `persistentHash` (not `transientHash`) is used because both values are stored in ledger state and must survive contract upgrades.

**`Map<K, V>`:** Five separate maps hold offer state. Compact maps support `.member(key)` for existence checks and indexed access `map[key]` for reads and writes. The `nft_owners` map uses `Uint<128>` token IDs as keys (Compact does not support 256-bit integers, so `Uint<128>` is the practical maximum).

**`assert()`:** Every circuit entry point validates preconditions before modifying state. Error message strings match the test file's `toThrow()` assertions exactly, making failures self-documenting and easy to debug.

---

## Privacy Properties

- **Offerer is pseudonymous.** Their derived public key is stored on-chain but cannot be reverse-engineered into their wallet address without the secret key. The key is stable across offers (intentional — see design decisions).

- **Offeree is fully hidden.** The offeree's identity is stored only as a hash. An observer who does not know the salt cannot determine who the offer is addressed to, even if they know the offeree's public key.

- **The ZK proof proves "I know the salt" without revealing it.** When `acceptOffer` or `rejectOffer` runs, the circuit computes `hash(my_pk || salt)` inside the ZK circuit and asserts it equals the stored commitment. The proof is valid only if the caller knows a `(pk, salt)` pair satisfying the equation — but neither value appears in the proof's public transcript.

- **Offer terms are public.** The NFT IDs being traded are visible to everyone. This is an intentional trade-off: hiding the NFT IDs would require a commit-reveal scheme with significant added complexity, while the main privacy goal (hiding who is trading with whom) is already achieved.

---

## Limitations and Trade-offs

- **No bounded Map enforcement.** Compact's `Map<K, V>` has no maximum size at the type level. A production version would enforce `assert(offer_count < MAX_OFFERS, "Board is full")` to prevent unbounded ledger growth.

- **No on-chain NFT standard.** The internal ownership map is correct for demonstration, but not interoperable with external NFT contracts or wallets. Midnight's inter-contract call limitation (as of this writing) makes a true cross-contract NFT system unavailable.

- **Salt distribution is out-of-band.** The offerer must share `(offer_id, salt)` with the offeree through a secure side channel. This is inherent to the commitment scheme. A production DApp would integrate with an encrypted messaging layer.

- **No offer expiry.** Offers remain pending indefinitely. Adding expiry would require comparing `block_height` from the circuit context against a stored threshold — possible in Compact but not implemented here to keep scope focused.

---

## How to Build and Test

```bash
# Prerequisites: Compact compiler (v0.29.0+), Node.js 22+

# 1. Install dependencies
npm install

# 2. Compile the contract (generates managed/nft-trade)
cd contract && npm run compact

# 3. Run the simulator tests (no proof server needed)
npm run test

# 4. TypeScript type check
npm run typecheck

# 5. Run the interactive CLI (requires proof server + wallet)
cd bboard-cli && npm run cli
```

The simulator tests cover all five circuits with at least two cases each: a success path and a failure path that exercises each `assert()` security guard.
