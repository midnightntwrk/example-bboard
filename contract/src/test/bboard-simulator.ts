// This file is part of midnightntwrk/example-bboard.
// Capstone (Track A): Multi-Post Board — test simulator.
// SPDX-License-Identifier: Apache-2.0

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
 * A test harness that drives the multi-post bulletin board contract entirely
 * in memory (no node, wallet, or proof server).
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
      createConstructorContext({ secretKey }, "0".repeat(64)),
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

  /** Switch to a different secret key, i.e. act as a different user. */
  public switchUser(secretKey: Uint8Array) {
    this.circuitContext.currentPrivateState = { secretKey };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): BBoardPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  /** Add a post from the current user; returns the updated ledger. */
  public post(message: string): Ledger {
    this.circuitContext = this.contract.impureCircuits.post(
      this.circuitContext,
      message,
    ).context;
    return this.getLedger();
  }

  /** Take down the post with the given id, as the current user. */
  public takeDown(id: bigint): Ledger {
    this.circuitContext = this.contract.impureCircuits.takeDown(
      this.circuitContext,
      id,
    ).context;
    return this.getLedger();
  }

  /**
   * The owner commitment the current user's secret key produces for a given
   * post id. Mirrors the on-chain `publicKey` circuit, which salts the hash
   * with the post id, so tests can check the stored owner without knowing the
   * hash internals.
   */
  public ownerKeyForId(id: bigint): Uint8Array {
    const idBytes = convertFieldToBytes(32, id, "bboard-simulator.ts");
    return this.contract.circuits.publicKey(
      this.circuitContext,
      this.getPrivateState().secretKey,
      idBytes,
    ).result;
  }
}
