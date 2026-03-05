# Track C: Sealed Ownership with Selective Disclosure

## What Was Built

This capstone implements **ownership hiding with selective disclosure** on the Midnight bulletin board (bboard) example. The `owner` field is changed from an exported (publicly visible) ledger entry to a non-exported (hidden from the TypeScript API) ledger field. A new `revealOwnership` circuit enables selective disclosure — the owner can prove their identity through a ZK proof that reveals only a boolean (`true`/`false`), never the actual key.

Before this change, the `owner` field was exported via `export ledger owner: Bytes<32>`, making the hashed public key available in the generated `Ledger` TypeScript type. Any DApp, indexer, or observer could read this hash and track which identity owned which post across time. This is a classic pseudonymity problem: the hash acts as a stable fingerprint.

After this change, `owner` is a non-exported ledger field (`ledger owner: Bytes<32>` — no `export`). It remains accessible inside circuits for authorization checks, but the Compact compiler excludes it from the generated `Ledger` type. The DApp layer (API and CLI) cannot read it directly. The only way to verify ownership is through the `revealOwnership` circuit, which discloses a single boolean — nothing more.

## GDPR Art. 25: Privacy by Design

This implementation directly maps to **GDPR Article 25** — Data Protection by Design and by Default:

- **Data minimization**: The public API no longer exposes any ownership identifier. The minimum necessary data (the message and board state) remains public; ownership is hidden by default.
- **Purpose limitation**: Ownership data is only accessible when explicitly needed (verification via ZK proof), not broadcast to all observers through the TypeScript API.
- **Privacy by default**: A new user interacting with the contract sees `<sealed>` for the owner field. No configuration or opt-in is required — privacy is the default state.

The `revealOwnership` circuit embodies the principle of **selective disclosure**: you prove a fact about yourself (I am the owner) without revealing your secret key. This is the ZK equivalent of showing a bouncer that you're over 21 without revealing your birth date.

## Compact Patterns Used

### Non-Exported Ledger Fields

```compact
// BEFORE: exported — visible in generated Ledger type
export ledger owner: Bytes<32>;

// AFTER: non-exported — hidden from generated Ledger type
ledger owner: Bytes<32>;
```

By removing `export`, the Compact compiler excludes `owner` from the generated TypeScript `Ledger` type. The field still exists in the contract's internal state and is fully accessible within circuits, but the DApp layer cannot read it. This is the simplest and most effective way to hide a field from external observers in Compact 0.21.

### Why Not `sealed`? A Lesson in Compact Semantics

The initial design called for `sealed ledger owner: Bytes<32>` — the intuition being that "sealed" means "private" or "hidden." This is a reasonable assumption coming from general-purpose languages or even from Solidity's access modifiers, but Compact uses `sealed` with a very specific meaning: **immutable after the constructor**, analogous to Solidity's `immutable` keyword.

The Compact 0.21 compiler enforces this statically: "exported circuits cannot modify sealed ledger fields." This isn't just about exported circuits — even non-exported helper circuits called (directly or indirectly) from exported circuits are rejected. The compiler traces the full call graph to verify that no code path reachable from an exported circuit can write to a sealed field.

This makes `sealed` the wrong tool for `owner`, which must change with every `post()` call. The three Compact visibility axes are:

| Mechanism | Controls | Analogy |
|-----------|----------|---------|
| `export` on ledger field | Whether the field appears in the generated TypeScript `Ledger` type | `public` vs `private` in OOP |
| `sealed` on ledger field | Whether the field can be written after constructor | `immutable` in Solidity |
| `disclose()` on values | Whether witness-derived data crosses the ZK privacy boundary | explicit declassification |

For our use case — a field that changes at runtime but should be invisible to DApp consumers — removing `export` is the correct and sufficient approach. It hides `owner` from the TypeScript API layer while keeping it fully accessible inside circuits for authorization (`takeDown`) and selective disclosure (`revealOwnership`).

This discovery demonstrates that privacy in Compact is achieved through the interplay of multiple mechanisms, not a single keyword. The `sealed` keyword protects against mutation; non-export protects against visibility; `disclose()` controls the ZK boundary. Understanding which lever to pull — and why — is essential for building privacy-preserving contracts on Midnight.

### `disclose()` Function

The `disclose()` function marks where witness-derived data crosses the privacy boundary. In `post`, it remains on the owner assignment because the Compact compiler requires explicit disclosure declarations for witness-derived values written to ledger:

```compact
owner = disclose(publicKey(localSecretKey(), ...));
```

In `revealOwnership`, `disclose()` is used strategically on the boolean comparison result — only revealing yes/no, not the key:

```compact
return disclose(owner == publicKey(localSecretKey(), ...));
```

This is the core of selective disclosure: the comparison happens inside the circuit, and only the boolean result is disclosed.

### Witnesses and Assertions

The `localSecretKey()` witness provides the user's secret key from private state into the circuit. The `assert()` statements enforce preconditions — for example, `revealOwnership` requires the board to be occupied, and `takeDown` still verifies that the caller's derived key matches the owner.

## Privacy Properties: Before vs After

| Property | Before | After |
|----------|--------|-------|
| Owner key in Ledger type | Yes (exported) | No (non-exported) |
| Owner readable by DApps | Yes (via `ledger.owner`) | No |
| Ownership verification | Compare hashes client-side | ZK proof (boolean only) |
| TakeDown authorization | Works via internal key comparison | Works identically (non-exported fields accessible in circuits) |
| Information leaked via API | 32-byte identifier per post | Nothing (only true/false on explicit verification) |

## Trade-offs

1. **No passive ownership detection**: In the original design, any DApp could check the `Ledger` type to see if a given key owned the current post. With hidden ownership, this requires an active circuit call (`revealOwnership`). This is a feature, not a bug — it prevents surveillance.

2. **Circuit call required for verification**: `revealOwnership` is an impure circuit, meaning on a real network it would require transaction submission and gas costs. This is the cost of privacy — verification is no longer "free" from the ledger API.

3. **Derived state simplified**: The API's `BBoardDerivedState` no longer computes `isOwner` from ledger state. Instead, it reports `ownershipSealed: true` as a constant, reflecting that ownership cannot be determined from public data alone.

## Limitations

- The owner hash still exists in the contract's internal state — a sufficiently advanced indexer with direct access to the underlying data store could potentially extract it. Full privacy would require Compact's ZK shielded state (future feature).
- The `revealOwnership` circuit is impure (it accesses non-exported ledger state), so it requires a transaction on-chain.
- The boolean result of `revealOwnership` is itself public once disclosed — an observer can see that *someone* verified ownership and whether the result was true or false. However, this only reveals information about the specific caller at that specific moment, not the owner's identity.
- The `publicKey` circuit remains exported and public. While it doesn't reveal the hidden owner, it could theoretically be used off-chain to compute a key for comparison if someone had access to the raw ledger data.

## Files Modified

| File | Change |
|------|--------|
| `contract/src/bboard.compact` | Removed `export` from `owner` ledger field, added `revealOwnership` circuit, bumped language to 0.21 |
| `contract/src/test/bboard-simulator.ts` | Replaced `publicKey()` with `revealOwnership()` method |
| `contract/src/test/bboard.test.ts` | Updated all tests to use `revealOwnership`, added 5 new test cases |
| `api/src/common-types.ts` | Replaced `isOwner: boolean` with `ownershipSealed: true` |
| `api/src/index.ts` | Simplified `state$` derivation (no more `combineLatest`), added `revealOwnership()` API method |
| `bboard-cli/src/index.ts` | Shows `<sealed>` for owner in ledger display, added menu option 7 for ZK ownership verification |
