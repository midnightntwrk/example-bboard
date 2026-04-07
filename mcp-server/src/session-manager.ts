import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { firstValueFrom } from 'rxjs';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { type Logger } from 'pino';
import { UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v7';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { BBoardAPI, type BBoardCircuitKeys, type BBoardDerivedState, bboardPrivateStateKey, type BBoardProviders } from '../../api/src/index.js';
import { createBBoardPrivateState, PostState, ledger } from '../../contract/src/index.js';
import { currentDir, type Config, PreviewRemoteConfig, PreprodRemoteConfig, StandaloneConfig } from '../../bboard-cli/src/config.js';
import { MidnightWalletProvider } from '../../bboard-cli/src/midnight-wallet-provider.js';
import { generateDust } from '../../bboard-cli/src/generate-dust.js';
import { getInitialUnshieldedState, syncWallet } from '../../bboard-cli/src/wallet-utils.js';
import { createMcpLogger } from './logger.js';
import { type JsonValue } from './protocol.js';

type SessionNetwork = 'preview' | 'preprod' | 'standalone';

export type SessionCredentials = {
  walletSeed: string;
  agentSecretKey: string;
};

export type SessionSummary = SessionCredentials & {
  sessionId: string;
  network: SessionNetwork;
  contractAddress?: string;
  walletAddress?: string;
  nightBalance?: string;
  boardJoined: boolean;
  hasAdminSecret: boolean;
  logPath: string;
  privateStateStoreName: string;
};

type SessionContext = {
  sessionId: string;
  network: SessionNetwork;
  config: Config;
  logger: Logger;
  logPath: string;
  testEnvironment: ReturnType<Config['getEnvironment']>;
  walletProvider: MidnightWalletProvider;
  providers: BBoardProviders;
  credentials: SessionCredentials & { adminSecret?: string };
  api?: BBoardAPI;
};

const MOUNTED_STATE_DIR = path.resolve(currentDir, '..', '..', 'mcp-state');

const normalizeHexSecret = (value: string, field: string): Uint8Array => {
  const normalized = value.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error(`'${field}' must be a 32-byte hex string`);
  }
  return Buffer.from(normalized, 'hex');
};

const randomHex32 = (): string => randomBytes(32).toString('hex');
const randomSessionId = (): string => randomBytes(8).toString('hex');

const stringifyBigInts = (value: unknown): JsonValue => {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => stringifyBigInts(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, stringifyBigInts(entry)]),
    ) as JsonValue;
  }
  return (value ?? null) as JsonValue;
};

const selectConfig = (network: SessionNetwork): Config => {
  switch (network) {
    case 'preview':
      return new PreviewRemoteConfig();
    case 'preprod':
      return new PreprodRemoteConfig();
    case 'standalone':
      return new StandaloneConfig();
  }
};

export class BBoardSessionManager {
  private readonly sessions = new Map<string, SessionContext>();

  async createSession(args: {
    network?: SessionNetwork;
    sessionId?: string;
    walletSeed?: string;
    agentSecretKey?: string;
    adminSecret?: string;
  }): Promise<SessionSummary> {
    const network = args.network ?? 'preview';
    const sessionId = args.sessionId ?? randomSessionId();

    if (this.sessions.has(sessionId)) {
      throw new Error(`Session '${sessionId}' already exists`);
    }

    const config = selectConfig(network);
    const logPath = path.resolve(MOUNTED_STATE_DIR, 'logs', `${sessionId}.log`);
    const logger = await createMcpLogger(logPath);
    const testEnvironment = config.getEnvironment(logger);
    const envConfiguration = await testEnvironment.start();

    const walletSeed = args.walletSeed ?? randomHex32();
    const walletProvider = await MidnightWalletProvider.build(logger, envConfiguration, walletSeed);
    await walletProvider.start();

    const privateStateStoreName = `bboard-mcp-${sessionId}-private-state`;
    const signingKeyStoreName = `bboard-mcp-${sessionId}-signing-keys`;
    const midnightDbName = path.resolve(MOUNTED_STATE_DIR, sessionId, 'midnight-level-db');

    const providers: BBoardProviders = {
      privateStateProvider: levelPrivateStateProvider({
        midnightDbName,
        privateStateStoreName,
        signingKeyStoreName,
        privateStoragePasswordProvider: () => 'bboard-mcp-private-state-password',
      }),
      publicDataProvider: indexerPublicDataProvider(envConfiguration.indexer, envConfiguration.indexerWS),
      zkConfigProvider: new NodeZkConfigProvider<BBoardCircuitKeys>(config.zkConfigPath),
      proofProvider: httpClientProofProvider(envConfiguration.proofServer, new NodeZkConfigProvider<BBoardCircuitKeys>(config.zkConfigPath)),
      walletProvider,
      midnightProvider: walletProvider,
    };

    const credentials: SessionCredentials & { adminSecret?: string } = {
      walletSeed,
      agentSecretKey: args.agentSecretKey ?? randomHex32(),
    };

    if (args.adminSecret !== undefined) {
      credentials.adminSecret = args.adminSecret;
    }

    await providers.privateStateProvider.set(
      bboardPrivateStateKey,
      createBBoardPrivateState(
        normalizeHexSecret(credentials.agentSecretKey, 'agentSecretKey'),
        normalizeHexSecret(credentials.adminSecret ?? '0'.repeat(64), 'adminSecret'),
      ),
    );

    const session: SessionContext = {
      sessionId,
      network,
      config: {
        ...config,
        privateStateStoreName,
      },
      logger,
      logPath,
      testEnvironment,
      walletProvider,
      providers,
      credentials,
    };

    this.sessions.set(sessionId, session);
    return this.getSessionSummary(sessionId);
  }

  async getSessionSummary(sessionId: string): Promise<SessionSummary> {
    const session = this.requireSession(sessionId);
    const initialState = await getInitialUnshieldedState(session.logger, session.walletProvider.wallet.unshielded);
    const walletAddress = UnshieldedAddress.codec.encode(getNetworkId(), initialState.address).toString();
    const nightBalance = initialState.balances[unshieldedToken().raw];

    return {
      sessionId: session.sessionId,
      network: session.network,
      walletSeed: session.credentials.walletSeed,
      agentSecretKey: session.credentials.agentSecretKey,
      contractAddress: session.api?.deployedContractAddress,
      walletAddress,
      nightBalance: nightBalance?.toString(),
      boardJoined: session.api !== undefined,
      hasAdminSecret: session.credentials.adminSecret !== undefined,
      logPath: session.logPath,
      privateStateStoreName: session.config.privateStateStoreName,
    };
  }

  async setAdminSecret(sessionId: string, adminSecret: string): Promise<SessionSummary> {
    const session = this.requireSession(sessionId);
    session.credentials.adminSecret = adminSecret;
    const privateState = await session.providers.privateStateProvider.get(bboardPrivateStateKey);
    const currentSecretKey = privateState?.secretKey ?? normalizeHexSecret(session.credentials.agentSecretKey, 'agentSecretKey');

    await session.providers.privateStateProvider.set(
      bboardPrivateStateKey,
      createBBoardPrivateState(currentSecretKey, normalizeHexSecret(adminSecret, 'adminSecret')),
    );

    return this.getSessionSummary(sessionId);
  }

  async waitForWalletReady(sessionId: string, timeoutMs = 180_000): Promise<SessionSummary> {
    const session = this.requireSession(sessionId);
    await syncWallet(session.logger, session.walletProvider.wallet, 2_000, timeoutMs);
    const unshieldedState = await getInitialUnshieldedState(session.logger, session.walletProvider.wallet.unshielded);

    if (session.config.generateDust) {
      const txHash = await generateDust(
        session.logger,
        session.credentials.walletSeed,
        unshieldedState,
        session.walletProvider.wallet,
      );
      if (txHash) {
        session.logger.info(`Submitted dust registration transaction: ${txHash}`);
        await syncWallet(session.logger, session.walletProvider.wallet, 2_000, timeoutMs);
      }
    }

    return this.getSessionSummary(sessionId);
  }

  async deployBoard(sessionId: string): Promise<{ session: SessionSummary; contractAddress: string }> {
    const session = this.requireSession(sessionId);
    session.api = await BBoardAPI.deploy(session.providers, session.logger);
    return {
      session: await this.getSessionSummary(sessionId),
      contractAddress: session.api.deployedContractAddress,
    };
  }

  async joinBoard(sessionId: string, contractAddress: string): Promise<{ session: SessionSummary; contractAddress: string }> {
    const session = this.requireSession(sessionId);
    session.api = await BBoardAPI.join(session.providers, contractAddress, session.logger);
    return {
      session: await this.getSessionSummary(sessionId),
      contractAddress: session.api.deployedContractAddress,
    };
  }

  async getBoardState(sessionId: string): Promise<{
    session: SessionSummary;
    derivedState: JsonValue;
    ledgerState: JsonValue;
    contractAddress: string;
  }> {
    const session = this.requireActiveBoard(sessionId);
    const derivedState = await firstValueFrom(session.api.state$);
    const ledgerState = await this.readLedgerState(session);
    return {
      session: await this.getSessionSummary(sessionId),
      derivedState: stringifyBigInts(this.serializeDerivedState(derivedState)),
      ledgerState: stringifyBigInts(ledgerState),
      contractAddress: session.api.deployedContractAddress,
    };
  }

  async submitPost(sessionId: string, message: string): Promise<JsonValue> {
    const session = this.requireActiveBoard(sessionId);
    await session.api.post(message);
    return this.getBoardState(sessionId);
  }

  async withdrawPending(sessionId: string): Promise<JsonValue> {
    const session = this.requireActiveBoard(sessionId);
    await session.api.takeDown();
    return this.getBoardState(sessionId);
  }

  async approvePending(sessionId: string): Promise<JsonValue> {
    const session = this.requireActiveBoard(sessionId);
    await session.api.approvePending();
    return this.getBoardState(sessionId);
  }

  async rejectPending(sessionId: string): Promise<JsonValue> {
    const session = this.requireActiveBoard(sessionId);
    await session.api.rejectPending();
    return this.getBoardState(sessionId);
  }

  async unpublishPublished(sessionId: string): Promise<JsonValue> {
    const session = this.requireActiveBoard(sessionId);
    await session.api.unpublishPublished();
    return this.getBoardState(sessionId);
  }

  async closeSession(sessionId: string): Promise<{ sessionId: string; closed: true }> {
    const session = this.requireSession(sessionId);
    this.sessions.delete(sessionId);
    await session.walletProvider.stop();
    await session.testEnvironment.shutdown();
    return { sessionId, closed: true };
  }

  async closeAll(): Promise<void> {
    await Promise.all(Array.from(this.sessions.keys()).map((sessionId) => this.closeSession(sessionId)));
  }

  private requireSession(sessionId: string): SessionContext {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown session '${sessionId}'`);
    }
    return session;
  }

  private requireActiveBoard(sessionId: string): SessionContext & { api: BBoardAPI } {
    const session = this.requireSession(sessionId);
    if (!session.api) {
      throw new Error(`Session '${sessionId}' has not joined or deployed a board yet`);
    }
    return session as SessionContext & { api: BBoardAPI };
  }

  private async readLedgerState(session: SessionContext & { api: BBoardAPI }): Promise<Record<string, JsonValue>> {
    const contractState = await session.providers.publicDataProvider.queryContractState(session.api.deployedContractAddress);
    if (contractState == null) {
      throw new Error(`No contract state found for ${session.api.deployedContractAddress}`);
    }
    const currentLedger = ledger(contractState.data);
    return {
      pendingState: PostState[currentLedger.pendingState],
      pendingMessage: currentLedger.pendingMessage.is_some ? currentLedger.pendingMessage.value : null,
      pendingOwner: toHex(currentLedger.pendingOwner),
      publishedState: PostState[currentLedger.publishedState],
      publishedMessage: currentLedger.publishedMessage.is_some ? currentLedger.publishedMessage.value : null,
      publishedOwner: toHex(currentLedger.publishedOwner),
      sequence: currentLedger.sequence.toString(),
    };
  }

  private serializeDerivedState(state: BBoardDerivedState): Record<string, JsonValue> {
    return {
      state: PostState[state.state],
      sequence: state.sequence.toString(),
      message: state.message ?? null,
      pendingState: PostState[state.pendingState],
      pendingMessage: state.pendingMessage ?? null,
      pendingIsOwner: state.pendingIsOwner,
      publishedState: PostState[state.publishedState],
      publishedMessage: state.publishedMessage ?? null,
      publishedIsOwner: state.publishedIsOwner,
      isAdmin: state.isAdmin,
      isOwner: state.isOwner,
    };
  }
}
