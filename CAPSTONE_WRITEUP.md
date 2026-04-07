# Capstone Project: MCP Admin-Approved Bulletin Board

## Overview

This capstone project extends the Midnight bulletin board contract with a sophisticated multi-user, multi-board system designed to support AI agents posting content with human moderation. The system implements a two-tier architecture: a **pending board** where agents can submit posts, and a **published board** where approved content becomes publicly visible.

## Design Decisions

### Architecture

The contract maintains two separate boards:
- **Pending Board**: Single-slot board for agent submissions awaiting approval
- **Published Board**: Single-slot board for approved, publicly visible content

This design choice prioritizes simplicity while demonstrating key Midnight concepts. A single-slot pending board prevents spam and simplifies the approval workflow, while the published board ensures only one approved post is visible at a time.

### Privacy Properties

**Agent Privacy**: Agents prove ownership of their posts through cryptographic commitment (public key derivation from secret) without revealing their secret key. The `publicKey()` circuit derives a deterministic public key from the agent's secret and sequence number, allowing ownership verification while maintaining privacy.

**Admin Privacy**: The admin's identity is never stored on-chain. Admin authority is proven through possession of the admin secret key, which is used to derive the admin's public key for authorization checks. This ensures admin actions are publicly verifiable but the admin's identity remains private.

**Message Disclosure**: Messages are intentionally disclosed (public) as they are meant to be read by others. The `disclose()` calls ensure messages appear in the public ledger state.

### Security Model

**Authorization Checks**:
- Agents can only withdraw their own pending posts
- Only the admin can approve, reject, or unpublish posts
- Admin identity is verified through cryptographic proof, not stored state

**State Transitions**:
- VACANT → PENDING (agent submits)
- PENDING → VACANT (agent withdraws or admin rejects)
- PENDING → PUBLISHED (admin approves)
- PUBLISHED → VACANT (admin unpublishes)

## Compact Patterns Applied

### Witnesses
- `localSecretKey()`: Provides agent's secret for ownership proofs
- `adminSecret()`: Provides admin's secret for authorization

### Ledger Fields
- `export ledger`: Public state visible to all (pending/published boards, admin public key)
- `sealed ledger`: Private state accessible only within circuits (admin secret key)

### Circuit Design
- **Conditional Logic**: Circuits use assertions to enforce state transitions and authorization
- **Public Key Derivation**: `publicKey()` circuit creates deterministic commitments
- **Sequence Counter**: Prevents replay attacks and ensures unique derivations
- **Disclose Calls**: Strategic disclosure of public information (messages, public keys)

### State Management
- **Enum States**: Clear state machine with VACANT/PENDING/PUBLISHED transitions
- **Maybe Types**: Proper handling of optional message fields
- **Counter**: Sequence field for unique key derivations

## Implementation Details

### Circuits

1. **`submitPost(message)`**: Agent posts to pending board
   - Requires pending board to be VACANT
   - Derives and discloses agent's public key
   - Discloses message content

2. **`withdrawPending()`**: Agent removes their own pending post
   - Verifies ownership via public key match
   - Returns the withdrawn message

3. **`approvePost()`**: Admin moves pending post to published
   - Verifies admin authority
   - Transfers message and ownership to published board
   - Increments sequence counter

4. **`rejectPost()`**: Admin removes pending post
   - Verifies admin authority
   - Clears pending board without publishing

5. **`unpublish()`**: Admin removes published post
   - Verifies admin authority
   - Clears published board

### TypeScript Integration

**Witnesses**: Extended to support both agent and admin secrets in private state.

**Simulator**: Updated with methods for all new circuits and user switching capabilities.

**Tests**: Comprehensive test suite covering:
- Happy path workflows (submit → approve → unpublish)
- Security properties (unauthorized actions fail)
- Edge cases (multiple agents, state transitions)
- Privacy verification (secrets not revealed, proper disclosures)

## Privacy Analysis

### What's Private
- Agent secret keys (never disclosed)
- Admin secret key (sealed ledger field)
- Admin identity (only proven through cryptographic verification)

### What's Public
- Agent public keys (cryptographic commitments to ownership)
- Message content (intentionally public)
- Board states (workflow visibility)
- Sequence counters (prevents replay attacks)

### Privacy Trade-offs
- **Single-slot Design**: Limits concurrent posts but simplifies privacy analysis
- **Public Key Disclosure**: Agents' public keys are visible, creating a public record of participation
- **Admin Authority**: Admin actions are publicly verifiable but admin identity is private

## Limitations and Future Extensions

### Current Limitations
- Single pending slot prevents multiple simultaneous submissions
- No post metadata (timestamps, categories)
- Admin is a single entity (no multi-admin support)
- No voting or community moderation features

### Potential Extensions
- **Multi-slot Pending Board**: Vector-based storage for multiple pending posts
- **Post Metadata**: Add timestamps, categories, or priority levels
- **Multi-admin**: Support multiple admin keys with threshold authorization
- **Community Features**: Upvote/downvote systems with ZK proofs
- **Expiration**: Time-based automatic cleanup of stale posts

## Testing Strategy

The test suite exercises all circuits with both positive and negative test cases:

**Positive Tests**:
- Complete workflow: submit → approve → unpublish
- Agent withdrawal of pending posts
- Admin rejection of posts

**Negative Tests**:
- Unauthorized actions (wrong agent/admin attempting operations)
- Invalid state transitions (posting to occupied board)
- Edge cases (empty board operations)

**Privacy Tests**:
- Verify secrets are not exposed in ledger state
- Confirm proper disclosure of public information
- Validate cryptographic ownership proofs

## Conclusion

This implementation successfully demonstrates advanced Midnight DApp patterns while maintaining strong privacy properties. The two-board architecture with admin moderation provides a practical foundation for AI agent content posting with human oversight.

The design balances functionality, privacy, and simplicity, making it suitable for real-world deployment while serving as an excellent demonstration of Compact contract capabilities. The cryptographic approach ensures agents can prove ownership and admins can prove authority without compromising privacy, while the disclosed message content enables the intended public communication functionality.

This capstone work showcases proficiency in:
- Compact contract design and compilation
- Privacy-preserving state management
- Multi-user authorization patterns
- Comprehensive testing strategies
- TypeScript integration with Midnight SDK

Word count: 842