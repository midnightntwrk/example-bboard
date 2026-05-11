import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { BBoardPrivateState, Contract, Witnesses } from '../../contract/src/index';

export const bboardPrivateStateKey = 'bboardPrivateState';
export type PrivateStateId = typeof bboardPrivateStateKey;

export type PrivateStates = {
  readonly bboardPrivateState: BBoardPrivateState;
};

export type BBoardContract = Contract<BBoardPrivateState, Witnesses<BBoardPrivateState>>;
export type BBoardCircuitKeys = Exclude<keyof BBoardContract['impureCircuits'], number | symbol>;
export type BBoardProviders = MidnightProviders<BBoardCircuitKeys, PrivateStateId, BBoardPrivateState>;
export type DeployedBBoardContract = FoundContract<BBoardContract>;

/**
 * Derived state for MANO — combines public ledger state with private state.
 * isOwner: true if the current secret key matches the enrolled participant.
 */
export type BBoardDerivedState = {
  readonly isEnrolled: boolean;
  readonly isRevoked: boolean;
  readonly milestoneCount: bigint;
  readonly checkInDate: string | undefined;
  readonly isPaused: boolean;
  readonly sequence: bigint;
  readonly isOwner: boolean;
};
