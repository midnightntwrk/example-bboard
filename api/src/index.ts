import * as BBoard from '../../contract/src/managed/bboard/contract/index.js';
import { type ContractAddress, convertFieldToBytes } from '@midnight-ntwrk/compact-runtime';
import { type Logger } from 'pino';
import {
  type BBoardDerivedState,
  type BBoardContract,
  type BBoardProviders,
  type DeployedBBoardContract,
  bboardPrivateStateKey,
} from './common-types.js';
import { CompiledBBoardContractContract } from '../../contract/src/index';
import * as utils from './utils/index.js';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { combineLatest, map, tap, from, type Observable } from 'rxjs';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { BBoardPrivateState, createBBoardPrivateState } from '../../contract/src/witnesses.js';

export interface DeployedBBoardAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<BBoardDerivedState>;
  enroll: (dateStr: string) => Promise<void>;
  checkIn: (dateStr: string) => Promise<void>;
  verifyMilestone: (threshold: bigint) => Promise<void>;
  revokeEnrollment: () => Promise<void>;
  pauseContract: () => Promise<void>;
  resumeContract: () => Promise<void>;
}

export class BBoardAPI implements DeployedBBoardAPI {
  private constructor(
    public readonly deployedContract: DeployedBBoardContract,
    providers: BBoardProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    providers.privateStateProvider.setContractAddress(this.deployedContractAddress);
    this.state$ = combineLatest(
      [
        providers.publicDataProvider.contractStateObservable(this.deployedContractAddress, { type: 'latest' }).pipe(
          map((contractState) => BBoard.ledger(contractState.data)),
          tap((ledgerState) =>
            logger?.trace({
              ledgerStateChanged: {
                ledgerState: {
                  isEnrolled: ledgerState.isEnrolled,
                  isRevoked: ledgerState.isRevoked,
                  milestoneCount: ledgerState.milestoneCount,
                  isPaused: ledgerState.isPaused,
                  owner: toHex(ledgerState.owner),
                },
              },
            }),
          ),
        ),
        from(providers.privateStateProvider.get(bboardPrivateStateKey) as Promise<BBoardPrivateState>),
      ],
      (ledgerState, privateState) => {
        const derivedOwner = BBoard.pureCircuits.publicKey(
          privateState.secretKey,
          convertFieldToBytes(32, ledgerState.sequence, 'api/src/index.ts'),
        );
        return {
          isEnrolled: ledgerState.isEnrolled,
          isRevoked: ledgerState.isRevoked,
          milestoneCount: ledgerState.milestoneCount,
          checkInDate: ledgerState.checkInDate.value,
          isPaused: ledgerState.isPaused,
          sequence: ledgerState.sequence,
          isOwner: toHex(ledgerState.owner) === toHex(derivedOwner),
        };
      },
    );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<BBoardDerivedState>;

  async enroll(dateStr: string): Promise<void> {
    this.logger?.info(`enrolling: ${dateStr}`);
    const txData = await this.deployedContract.callTx.enroll(dateStr);
    this.logger?.trace({ transactionAdded: { circuit: 'enroll', txHash: txData.public.txHash } });
  }

  async checkIn(dateStr: string): Promise<void> {
    this.logger?.info(`checkIn: ${dateStr}`);
    const txData = await this.deployedContract.callTx.checkIn(dateStr);
    this.logger?.trace({ transactionAdded: { circuit: 'checkIn', txHash: txData.public.txHash } });
  }

  async verifyMilestone(threshold: bigint): Promise<void> {
    this.logger?.info(`verifyMilestone: ${threshold}`);
    const txData = await this.deployedContract.callTx.verifyMilestone(threshold);
    this.logger?.trace({ transactionAdded: { circuit: 'verifyMilestone', txHash: txData.public.txHash } });
  }

  async revokeEnrollment(): Promise<void> {
    this.logger?.info('revokeEnrollment');
    const txData = await this.deployedContract.callTx.revokeEnrollment();
    this.logger?.trace({ transactionAdded: { circuit: 'revokeEnrollment', txHash: txData.public.txHash } });
  }

  async pauseContract(): Promise<void> {
    this.logger?.info('pauseContract');
    const txData = await this.deployedContract.callTx.pauseContract();
    this.logger?.trace({ transactionAdded: { circuit: 'pauseContract', txHash: txData.public.txHash } });
  }

  async resumeContract(): Promise<void> {
    this.logger?.info('resumeContract');
    const txData = await this.deployedContract.callTx.resumeContract();
    this.logger?.trace({ transactionAdded: { circuit: 'resumeContract', txHash: txData.public.txHash } });
  }

  static async deploy(providers: BBoardProviders, logger?: Logger): Promise<BBoardAPI> {
    logger?.info('deployContract');
    const deployedBBoardContract = await deployContract(providers, {
      compiledContract: CompiledBBoardContractContract,
      privateStateId: bboardPrivateStateKey,
      initialPrivateState: createBBoardPrivateState(utils.randomBytes(32)),
    });
    return new BBoardAPI(deployedBBoardContract, providers, logger);
  }

  static async join(providers: BBoardProviders, contractAddress: ContractAddress, logger?: Logger): Promise<BBoardAPI> {
    logger?.info({ joinContract: { contractAddress } });
    const deployedBBoardContract = await findDeployedContract<BBoardContract>(providers, {
      contractAddress,
      compiledContract: CompiledBBoardContractContract,
      privateStateId: bboardPrivateStateKey,
      initialPrivateState: await BBoardAPI.getPrivateState(providers, contractAddress),
    });
    return new BBoardAPI(deployedBBoardContract, providers, logger);
  }

  private static async getPrivateState(providers: BBoardProviders, contractAddress: ContractAddress): Promise<BBoardPrivateState> {
    providers.privateStateProvider.setContractAddress(contractAddress);
    const existingPrivateState = await providers.privateStateProvider.get(bboardPrivateStateKey);
    return existingPrivateState ?? createBBoardPrivateState(utils.randomBytes(32));
  }
}

export * as utils from './utils/index.js';
export * from './common-types.js';
