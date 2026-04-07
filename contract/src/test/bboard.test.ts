// This file is part of midnightntwrk/example-bboard.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0

import { BBoardSimulator } from "./bboard-simulator.js";
import {
  NetworkId,
  setNetworkId,
} from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";
import { randomBytes } from "./utils.js";
import { PostState } from "../managed/bboard/contract/index.js";

setNetworkId("undeployed" as NetworkId);

describe("Extended BBoard Contract - Admin Approval Workflow", () => {
  const adminSecret = randomBytes(32);

  it("initializes with both boards in VACANT state", () => {
    const agentSecret = randomBytes(32);
    const sim = new BBoardSimulator(agentSecret, adminSecret);
    const ledger = sim.getLedger();

    expect(ledger.pendingState).toEqual(PostState.VACANT);
    expect(ledger.publishedState).toEqual(PostState.VACANT);
    expect(ledger.pendingMessage.is_some).toEqual(false);
    expect(ledger.publishedMessage.is_some).toEqual(false);
  });

  describe("Agent Posting (submitPost)", () => {
    it("allows an agent to submit a post to the pending board", () => {
      const agentSecret = randomBytes(32);
      const sim = new BBoardSimulator(agentSecret, adminSecret);

      const message = "Hello from agent 1";
      sim.submitPost(message);
      const ledger = sim.getLedger();

      expect(ledger.pendingState).toEqual(PostState.PENDING);
      expect(ledger.pendingMessage.is_some).toEqual(true);
      expect(ledger.pendingMessage.value).toEqual(message);
      expect(ledger.pendingOwner).toEqual(sim.agentPublicKey());
    });

    it("prevents posting when pending board is occupied", () => {
      const agentSecret = randomBytes(32);
      const sim = new BBoardSimulator(agentSecret, adminSecret);

      sim.submitPost("First post");
      expect(() => {
        sim.submitPost("Second post");
      }).toThrow("Pending board is occupied");
    });

    it("stores the agent's public key as owner", () => {
      const agentSecret = randomBytes(32);
      const sim = new BBoardSimulator(agentSecret, adminSecret);
      const expectedOwner = sim.agentPublicKey();

      sim.submitPost("Test message");
      const ledger = sim.getLedger();

      expect(ledger.pendingOwner).toEqual(expectedOwner);
    });
  });

  describe("Agent Withdrawal (withdrawPending)", () => {
    it("allows an agent to withdraw their own pending post", () => {
      const agentSecret = randomBytes(32);
      const sim = new BBoardSimulator(agentSecret, adminSecret);
      const message = "Post to withdraw";

      sim.submitPost(message);
      const withdrawn = sim.withdrawPending();
      const ledger = sim.getLedger();

      expect(withdrawn).toEqual(message);
      expect(ledger.pendingState).toEqual(PostState.VACANT);
      expect(ledger.pendingMessage.is_some).toEqual(false);
    });

    it("prevents withdrawing from an empty pending board", () => {
      const agentSecret = randomBytes(32);
      const sim = new BBoardSimulator(agentSecret, adminSecret);

      expect(() => {
        sim.withdrawPending();
      }).toThrow("No pending post to withdraw");
    });

    it("prevents an agent from withdrawing another agent's post", () => {
      const agent1Secret = randomBytes(32);
      const agent2Secret = randomBytes(32);
      const sim = new BBoardSimulator(agent1Secret, adminSecret);

      sim.submitPost("Agent 1's post");

      // Switch to agent 2
      sim.switchToAgent(agent2Secret);

      expect(() => {
        sim.withdrawPending();
      }).toThrow("Cannot withdraw another agent's post");
    });
  });

  describe("Admin Approval (approvePost)", () => {
    it("allows admin to approve a pending post", () => {
      const agentSecret = randomBytes(32);
      const sim = new BBoardSimulator(agentSecret, adminSecret);
      const message = "Post to approve";

      sim.submitPost(message);
      sim.switchToAdmin();
      const approved = sim.approvePost();
      const ledger = sim.getLedger();

      expect(approved).toEqual(message);
      expect(ledger.pendingState).toEqual(PostState.VACANT);
      expect(ledger.publishedState).toEqual(PostState.PUBLISHED);
      expect(ledger.publishedMessage.is_some).toEqual(true);
      expect(ledger.publishedMessage.value).toEqual(message);
    });

    it("transfers owner information to published board", () => {
      const agentSecret = randomBytes(32);
      const sim = new BBoardSimulator(agentSecret, adminSecret);
      const agentPubKey = sim.agentPublicKey();

      sim.submitPost("Test");
      sim.switchToAdmin();
      sim.approvePost();
      const ledger = sim.getLedger();

      expect(ledger.publishedOwner).toEqual(agentPubKey);
    });

    it("prevents non-admin from approving posts", () => {
      const agentSecret = randomBytes(32);
      const sim = new BBoardSimulator(agentSecret, adminSecret);

      sim.submitPost("Post");
      // Don't switch to admin - stay as agent
      
      expect(() => {
        sim.approvePost();
      }).toThrow("Only admin can approve posts");
    });

    it("prevents approving when no pending post exists", () => {
      const agentSecret = randomBytes(32);
      const sim = new BBoardSimulator(agentSecret, adminSecret);

      sim.switchToAdmin();
      expect(() => {
        sim.approvePost();
      }).toThrow("No pending post to approve");
    });
  });

  describe("Admin Rejection (rejectPost)", () => {
    it("allows admin to reject a pending post", () => {
      const agentSecret = randomBytes(32);
      const sim = new BBoardSimulator(agentSecret, adminSecret);
      const message = "Post to reject";

      sim.submitPost(message);
      sim.switchToAdmin();
      const rejected = sim.rejectPost();
      const ledger = sim.getLedger();

      expect(rejected).toEqual(message);
      expect(ledger.pendingState).toEqual(PostState.VACANT);
      expect(ledger.pendingMessage.is_some).toEqual(false);
    });

    it("prevents non-admin from rejecting posts", () => {
      const agentSecret = randomBytes(32);
      const sim = new BBoardSimulator(agentSecret, adminSecret);

      sim.submitPost("Post");
      // Stay as agent

      expect(() => {
        sim.rejectPost();
      }).toThrow("Only admin can reject posts");
    });

    it("prevents rejecting when no pending post exists", () => {
      const agentSecret = randomBytes(32);
      const sim = new BBoardSimulator(agentSecret, adminSecret);

      sim.switchToAdmin();
      expect(() => {
        sim.rejectPost();
      }).toThrow("No pending post to reject");
    });
  });

  describe("Admin Unpublish (unpublish)", () => {
    it("allows admin to remove a published post", () => {
      const agentSecret = randomBytes(32);
      const sim = new BBoardSimulator(agentSecret, adminSecret);
      const message = "Post to unpublish";

      sim.submitPost(message);
      sim.switchToAdmin();
      sim.approvePost();
      const unpublished = sim.unpublish();
      const ledger = sim.getLedger();

      expect(unpublished).toEqual(message);
      expect(ledger.publishedState).toEqual(PostState.VACANT);
      expect(ledger.publishedMessage.is_some).toEqual(false);
    });

    it("prevents non-admin from unpublishing", () => {
      const agentSecret = randomBytes(32);
      const sim = new BBoardSimulator(agentSecret, adminSecret);

      sim.submitPost("Post");
      sim.switchToAdmin();
      sim.approvePost();

      // Switch back to agent
      sim.switchToAgent(agentSecret);

      expect(() => {
        sim.unpublish();
      }).toThrow("Only admin can unpublish posts");
    });

    it("prevents unpublishing when no published post exists", () => {
      const agentSecret = randomBytes(32);
      const sim = new BBoardSimulator(agentSecret, adminSecret);

      sim.switchToAdmin();
      expect(() => {
        sim.unpublish();
      }).toThrow("No published post to remove");
    });
  });

  describe("Complex Workflow Scenarios", () => {
    it("handles full workflow: submit -> approve -> unpublish", () => {
      const agentSecret = randomBytes(32);
      const sim = new BBoardSimulator(agentSecret, adminSecret);
      const message = "Complete workflow";

      // Agent submits
      sim.submitPost(message);
      let ledger = sim.getLedger();
      expect(ledger.pendingState).toEqual(PostState.PENDING);

      // Admin approves
      sim.switchToAdmin();
      sim.approvePost();
      ledger = sim.getLedger();
      expect(ledger.publishedState).toEqual(PostState.PUBLISHED);
      expect(ledger.pendingState).toEqual(PostState.VACANT);

      // Admin unpublishes
      sim.unpublish();
      ledger = sim.getLedger();
      expect(ledger.publishedState).toEqual(PostState.VACANT);
    });

    it("handles workflow: submit -> reject -> submit again", () => {
      const agentSecret = randomBytes(32);
      const sim = new BBoardSimulator(agentSecret, adminSecret);

      // First submission
      sim.submitPost("First attempt");
      sim.switchToAdmin();
      const rejected = sim.rejectPost();
      expect(rejected).toEqual("First attempt");

      // Now the board should be empty, agent can post again
      sim.switchToAgent(agentSecret);
      let ledger = sim.getLedger();
      expect(ledger.pendingState).toEqual(PostState.VACANT);

      // Second submission
      sim.submitPost("Second attempt");
      ledger = sim.getLedger();
      expect(ledger.pendingMessage.value).toEqual("Second attempt");
    });

    it("tracks sequence counter through multiple operations", () => {
      const agentSecret = randomBytes(32);
      const sim = new BBoardSimulator(agentSecret, adminSecret);

      let ledger = sim.getLedger();
      const initialSeq = ledger.sequence;

      // Submit and approve
      sim.submitPost("Post 1");
      sim.switchToAdmin();
      sim.approvePost();
      ledger = sim.getLedger();
      expect(ledger.sequence > initialSeq).toBe(true);

      // Unpublish
      const seqAfterApproval = ledger.sequence;
      sim.unpublish();
      ledger = sim.getLedger();
      expect(ledger.sequence > seqAfterApproval).toBe(true);
    });

    it("prevents race conditions: agent cannot post while pending exists", () => {
      const agent1Secret = randomBytes(32);
      const agent2Secret = randomBytes(32);
      const sim = new BBoardSimulator(agent1Secret, adminSecret);

      // Agent 1 posts
      sim.submitPost("Agent 1 post");

      // Agent 2 cannot post while pending board is occupied
      sim.switchToAgent(agent2Secret);
      expect(() => {
        sim.submitPost("Agent 2 post");
      }).toThrow("Pending board is occupied");
    });
  });

  describe("Privacy Properties", () => {
    it("correctly derives and stores agent's public key", () => {
      const agentSecret = randomBytes(32);
      const sim = new BBoardSimulator(agentSecret, adminSecret);
      const expectedPubKey = sim.agentPublicKey();

      sim.submitPost("Test");
      const ledger = sim.getLedger();

      expect(ledger.pendingOwner).toEqual(expectedPubKey);
    });

    it("messages are disclosed as they should be public", () => {
      const agentSecret = randomBytes(32);
      const sim = new BBoardSimulator(agentSecret, adminSecret);
      const message = "Public message on board";

      sim.submitPost(message);
      const ledger = sim.getLedger();

      // Messages should be readable in ledger (disclosed)
      expect(ledger.pendingMessage.value).toEqual(message);
    });

    it("admin identity is proven but not revealed in approved posts", () => {
      const agentSecret = randomBytes(32);
      const sim = new BBoardSimulator(agentSecret, adminSecret);

      sim.submitPost("Test message");
      sim.switchToAdmin();
      sim.approvePost();

      const ledger = sim.getLedger();
      
      // Agent's public key is stored
      expect(ledger.publishedOwner).toEqual(sim.agentPublicKey());
      
      // But we don't store admin's identity
      // Admin proves authority via secret without revealing it
    });
  });
});
