// This file is part of midnightntwrk/example-bboard.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  type CircuitContext,
  QueryContext,
  sampleContractAddress,
  convertFieldToBytes,
  createConstructorContext,
  CostModel,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger,
} from "../managed/bboard/contract/index.js";
import { type BBoardPrivateState, witnesses } from "../witnesses.js";

/**
 * Serves as a testbed to exercise the contract in tests
 */
export class BBoardSimulator {
  readonly contract: Contract<BBoardPrivateState>;
  circuitContext: CircuitContext<BBoardPrivateState>;
  private secretKey: Uint8Array;
  private adminSecret: Uint8Array;

  constructor(secretKey: Uint8Array, adminSecret: Uint8Array) {
    this.secretKey = secretKey;
    this.adminSecret = adminSecret;

    this.contract = new Contract<BBoardPrivateState>(witnesses);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState,
    } = this.contract.initialState(
      createConstructorContext({ secretKey, adminSecret }, "0".repeat(64)),
    );
    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(
        currentContractState.data,
        sampleContractAddress(),
      ),
    };
  }

  /**
   * Switch to a different agent (different secret key)
   */
  public switchToAgent(secretKey: Uint8Array) {
    this.secretKey = secretKey;
    this.circuitContext.currentPrivateState = {
      secretKey,
      adminSecret: this.adminSecret,
    };
  }

  /**
   * Switch to admin context (needed for admin operations)
   */
  public switchToAdmin() {
    this.circuitContext.currentPrivateState = {
      secretKey: this.secretKey,
      adminSecret: this.adminSecret,
    };
  }

  /**
   * Switch to agent context (resets to current agent)
   */
  public switchToAgentMode() {
    this.circuitContext.currentPrivateState = {
      secretKey: this.secretKey,
      adminSecret: this.adminSecret,
    };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): BBoardPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  /**
   * Agent submits a post to the pending board
   */
  public submitPost(message: string): Ledger {
    this.circuitContext = this.contract.impureCircuits.submitPost(
      this.circuitContext,
      message,
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  /**
   * Agent withdraws their own pending post
   */
  public withdrawPending(): string {
    const result = this.contract.impureCircuits.withdrawPending(
      this.circuitContext,
    );
    this.circuitContext = result.context;
    // The result is the message that was withdrawn
    return result.result;
  }

  /**
   * Admin approves a pending post and moves it to published
   */
  public approvePost(): string {
    const result = this.contract.impureCircuits.approvePost(
      this.circuitContext,
    );
    this.circuitContext = result.context;
    return result.result;
  }

  /**
   * Admin rejects a pending post
   */
  public rejectPost(): string {
    const result = this.contract.impureCircuits.rejectPost(this.circuitContext);
    this.circuitContext = result.context;
    return result.result;
  }

  /**
   * Admin unpublishes a post (removes it from published board)
   */
  public unpublish(): string {
    const result = this.contract.impureCircuits.unpublish(this.circuitContext);
    this.circuitContext = result.context;
    return result.result;
  }

  /**
   * Compute the public key for the current agent
   */
  public agentPublicKey(): Uint8Array {
    const sequence = convertFieldToBytes(
      32,
      this.getLedger().sequence,
      "bboard-simulator.ts",
    );
    return this.contract.circuits.publicKey(
      this.circuitContext,
      this.secretKey,
      sequence,
    ).result;
  }

  /**
   * Get the admin's public key
   */
  public adminPublicKey(): Uint8Array {
    const sequence = convertFieldToBytes(
      32,
      this.getLedger().sequence,
      "bboard-simulator.ts",
    );
    return this.contract.circuits.publicKey(
      this.circuitContext,
      this.adminSecret,
      sequence,
    ).result;
  }
}
