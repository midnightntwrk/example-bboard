# MANO — Anonymous Check-In with ZK Attendance Credentials

**Developer:** Andres F. Chavez — Anonymous Haven LLC  
**Track:** D — Custom Extension  
**Network:** Midnight Preprod  
**Hackathon:** May 15, 2026

---

## What This Is and Why It Exists

MANO is a zero-knowledge anonymous check-in system built for a peer recovery overdose drop-in center (ODC) operated by Recovery Alliance in El Paso, Texas. The people who walk through that door are among the most vulnerable in any community — unhoused, in active addiction, often with criminal justice involvement. Many have been burned by systems that promised confidentiality and then used their data against them.

The core problem: recovery service providers need attendance records to satisfy funder reporting requirements, but participants need genuine privacy protection. Traditional databases create a permanent, identifiable record of every visit. Even "de-identified" data can be re-linked. For people who have been criminalized for their substance use, that risk is not abstract.

MANO's answer is **private by default, transparent by choice**. A participant enrolls once and receives a ZK credential. Every subsequent check-in proves they are the enrolled participant — without ever revealing who they are. The on-chain record shows that *someone* checked in on *this date* and has *this many* verified visits. Nothing else.

When a participant wants to use their attendance record — for employment verification, housing applications, or reentry programs — they can selectively disclose their milestone count to a specific verifier, cryptographically proven, without revealing their identity to the blockchain or to anyone else in the system.

This is a real application being built for real people. The Midnight blockchain makes it possible.

---

## Compact Patterns Used

### Sealed vs. Exported Ledger Fields

The contract uses `export ledger` for all fields. The privacy of participant identity does not come from hiding the `owner` field itself — it comes from the fact that `owner` stores a *derived public key*, not any real-world identifier. Without the secret key that generated it, the on-chain value reveals nothing.

```compact
export ledger owner: Bytes<32>;       // derived public key — reveals no identity
export ledger isEnrolled: Boolean;    // public enrollment status
export ledger milestoneCount: Counter; // verifiable attendance count
```

### The `disclose()` Requirement

Any value derived from a witness (private data) that gets stored in the ledger must be wrapped in `disclose()`. This is one of Compact's most important safety constraints — it makes the boundary between private and public explicit and auditable.

```compact
owner = disclose(pk);
isEnrolled = disclose(true);
```

### Witness Functions and Private State

The `localSecretKey` witness provides the participant's private credential — a 32-byte value derived from their biometric or device ID that never leaves their machine. The ZK proof system proves knowledge of this key without transmitting it.

```compact
witness localSecretKey(): Bytes<32>;
```

### Pure Circuits for Deterministic Derivation

`publicKey` is declared as `export pure circuit` — it has no side effects and is deterministic. Given the same secret key, it always produces the same public key. This is the foundation of the ownership proof: enroll with a derived key, prove ownership by re-deriving the same key.

```compact
export pure circuit publicKey(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>(
    [pad(32, "mano:participant:"), sk]
  );
}
```

Domain separation via `pad(32, "mano:participant:")` ensures hashes produced by this contract cannot collide with hashes from other contract types.

### Circuit Breaker Pattern

`isPaused` is a Boolean ledger field checked at the start of every circuit. The `pauseContract` and `resumeContract` admin circuits implement an emergency stop — if a vulnerability is discovered or an operational issue arises, the contract can be frozen without destroying participant data.

### Counter Fields

`sequence` and `milestoneCount` use Compact's `Counter` type, which increments monotonically. `milestoneCount` is the verifiable credential value — the number of confirmed check-ins. `sequence` tracks visit history on the ledger.

---

## Privacy Properties

| Data | On-chain | Visible to staff | Visible to verifier |
|---|---|---|---|
| Participant name / identity | Never | Never | Never |
| Secret key / biometric | Never | Never | Never |
| Enrollment status | Yes (boolean) | Yes | Only if disclosed |
| Check-in date | Yes (string) | Yes | Only if disclosed |
| Milestone count | Yes (integer) | Yes | Only if disclosed |
| Owner (derived public key) | Yes | Yes | Reveals nothing without secret key |

The system proves three things without revealing identity: (1) this person is enrolled, (2) they are the enrolled participant, (3) they have attended a certain number of times.

---

## Trade-offs

**Fixed identity commitment vs. session-scoped keys.** An earlier version derived the public key from both the secret key and the current sequence, producing a different public key each session — stronger unlinkability. This was removed because it broke the ownership check after sequence increments. The current design uses a fixed commitment: `hash("mano:participant:", sk)`. The trade-off is that all check-ins by the same participant share the same derived public key on-chain. For a single-enrollment-per-contract model, this is acceptable.

**One contract per participant.** Each enrollment deploys a separate contract instance. This maximizes isolation between participants but increases chain footprint. A future version could use a single registry contract with per-participant sub-states.

**Admin circuits are ungated.** `revokeEnrollment`, `pauseContract`, and `resumeContract` have no on-chain access control in this version — any caller can invoke them in the simulator. Production deployment would add an admin public key commitment checked at the start of those circuits.

**`verifyMilestone` uses equality, not inequality.** Compact circuits cannot perform `>=` comparisons on Field types directly — ZK arithmetic over finite fields does not support inequality without range proofs. The current design proves an exact milestone count. Future work could implement a range proof gadget for threshold verification.
