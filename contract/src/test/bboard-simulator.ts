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
  constructorContext,
  convert_bigint_to_Uint8Array,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger,
} from "../managed/bboard/contract/index.cjs";
import { type BBoardPrivateState, witnesses } from "../witnesses.js";

/**
 * Serves as a testbed to exercise the contract in tests
 */
export class BBoardSimulator {
  readonly contract: Contract<BBoardPrivateState>;
  circuitContext: CircuitContext<BBoardPrivateState>;

  constructor(secretKey: Uint8Array) {
    this.contract = new Contract<BBoardPrivateState>(witnesses);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState,
    } = this.contract.initialState(
      constructorContext({ secretKey }, "0".repeat(64)),
    );
    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      originalState: currentContractState,
      transactionContext: new QueryContext(
        currentContractState.data,
        sampleContractAddress(),
      ),
    };
  }

  /***
   * Switch to a different secret key for a different user
   *
   * TODO: is there a nicer abstraction for testing multi-user dApps?
   */
  public switchUser(secretKey: Uint8Array) {
    this.circuitContext.currentPrivateState = {
      secretKey,
    };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.transactionContext.state);
  }

  public getPrivateState(): BBoardPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  public post(message: string): Ledger {
    // Update the current context to be the result of executing the circuit.
    this.circuitContext = this.contract.impureCircuits.post(
      this.circuitContext,
      message,
    ).context;
    return ledger(this.circuitContext.transactionContext.state);
  }

  public takeDown(): Ledger {
    this.circuitContext = this.contract.impureCircuits.takeDown(
      this.circuitContext,
    ).context;
    return ledger(this.circuitContext.transactionContext.state);
  }

  public publicKey(): Uint8Array {
    const sequence = convert_bigint_to_Uint8Array(
      32,
      this.getLedger().sequence,
    );
    return this.contract.circuits.publicKey(
      this.circuitContext,
      this.getPrivateState().secretKey,
      sequence,
    ).result;
  }
}
