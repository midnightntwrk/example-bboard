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
 * MANO Simulator — exercises the anonymous check-in contract in tests
 * without a live proof server or blockchain connection.
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

  public switchUser(secretKey: Uint8Array) {
    this.circuitContext.currentPrivateState = { secretKey };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): BBoardPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  public publicKey(): Uint8Array {
    return this.contract.circuits.publicKey(
      this.circuitContext,
      this.getPrivateState().secretKey,
    ).result;
  }

  public enroll(dateStr: string): Ledger {
    this.circuitContext = this.contract.impureCircuits.enroll(
      this.circuitContext,
      dateStr,
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public checkIn(dateStr: string): Ledger {
    this.circuitContext = this.contract.impureCircuits.checkIn(
      this.circuitContext,
      dateStr,
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public verifyMilestone(threshold: bigint): Ledger {
    this.circuitContext = this.contract.impureCircuits.verifyMilestone(
      this.circuitContext,
      threshold,
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public revokeEnrollment(): Ledger {
    this.circuitContext = this.contract.impureCircuits.revokeEnrollment(
      this.circuitContext,
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public pauseContract(): Ledger {
    this.circuitContext = this.contract.impureCircuits.pauseContract(
      this.circuitContext,
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public resumeContract(): Ledger {
    this.circuitContext = this.contract.impureCircuits.resumeContract(
      this.circuitContext,
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }
}
