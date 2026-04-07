import { describe, expect, it, vi } from 'vitest';
import { BBoardMcpServer, type BBoardSessionService } from './server.js';
import { JSON_RPC_VERSION, ErrorCodes, type JsonRpcMessage } from './protocol.js';
import { type SessionSummary } from './session-manager.js';
import { type McpConnection, type McpTransport } from './transports.js';

class NoopTransport implements McpTransport {
  async listen(): Promise<void> {}
}

const createSessions = (): BBoardSessionService => ({
  createSession: vi.fn(async () => ({
    sessionId: 's1',
    network: 'preview',
    walletSeed: 'wallet',
    agentSecretKey: 'agent',
    boardJoined: false,
    hasAdminSecret: false,
    logPath: '/tmp/log',
    privateStateStoreName: 'store',
  } satisfies SessionSummary)),
  getSessionSummary: vi.fn(async () => ({
    sessionId: 's1',
    network: 'preview',
    walletSeed: 'wallet',
    agentSecretKey: 'agent',
    boardJoined: false,
    hasAdminSecret: false,
    logPath: '/tmp/log',
    privateStateStoreName: 'store',
  } satisfies SessionSummary)),
  setAdminSecret: vi.fn(async () => ({
    sessionId: 's1',
    network: 'preview',
    walletSeed: 'wallet',
    agentSecretKey: 'agent',
    boardJoined: false,
    hasAdminSecret: true,
    logPath: '/tmp/log',
    privateStateStoreName: 'store',
  } satisfies SessionSummary)),
  waitForWalletReady: vi.fn(async () => ({
    sessionId: 's1',
    network: 'preview',
    walletSeed: 'wallet',
    agentSecretKey: 'agent',
    boardJoined: false,
    hasAdminSecret: false,
    logPath: '/tmp/log',
    privateStateStoreName: 'store',
  } satisfies SessionSummary)),
  deployBoard: vi.fn(async () => ({
    session: {
      sessionId: 's1',
      network: 'preview',
      walletSeed: 'wallet',
      agentSecretKey: 'agent',
      boardJoined: true,
      hasAdminSecret: false,
      logPath: '/tmp/log',
      privateStateStoreName: 'store',
    } satisfies SessionSummary,
    contractAddress: 'abc',
  })),
  joinBoard: vi.fn(async () => ({
    session: {
      sessionId: 's1',
      network: 'preview',
      walletSeed: 'wallet',
      agentSecretKey: 'agent',
      boardJoined: true,
      hasAdminSecret: false,
      logPath: '/tmp/log',
      privateStateStoreName: 'store',
    } satisfies SessionSummary,
    contractAddress: 'abc',
  })),
  getBoardState: vi.fn(async () => ({
    session: {
      sessionId: 's1',
      network: 'preview',
      walletSeed: 'wallet',
      agentSecretKey: 'agent',
      boardJoined: true,
      hasAdminSecret: false,
      logPath: '/tmp/log',
      privateStateStoreName: 'store',
    } satisfies SessionSummary,
    contractAddress: 'abc',
    derivedState: { state: 'VACANT' },
    ledgerState: { pendingState: 'VACANT' },
  })),
  submitPost: vi.fn(async () => ({ ok: true })),
  withdrawPending: vi.fn(async () => ({ ok: true })),
  approvePending: vi.fn(async () => ({ ok: true })),
  rejectPending: vi.fn(async () => ({ ok: true })),
  unpublishPublished: vi.fn(async () => ({ ok: true })),
  closeSession: vi.fn(async () => ({ sessionId: 's1', closed: true as const })),
  closeAll: vi.fn(async () => undefined),
});

const createConnection = () => {
  const messages: JsonRpcMessage[] = [];
  const connection: McpConnection = {
    id: 'test-connection',
    send: (message) => {
      messages.push(message);
    },
  };
  return { connection, messages };
};

describe('BBoardMcpServer', () => {
  it('requires initialize before requests by default', async () => {
    const sessions = createSessions();
    const server = new BBoardMcpServer(new NoopTransport(), {}, sessions);
    const { connection, messages } = createConnection();

    await server.processIncomingMessage(connection, {
      jsonrpc: JSON_RPC_VERSION,
      id: 1,
      method: 'tools/list',
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      jsonrpc: JSON_RPC_VERSION,
      id: 1,
      error: { code: ErrorCodes.invalidRequest },
    });
  });

  it('returns tools after initialization notification', async () => {
    const sessions = createSessions();
    const server = new BBoardMcpServer(new NoopTransport(), {}, sessions);
    const { connection, messages } = createConnection();

    await server.processIncomingMessage(connection, {
      jsonrpc: JSON_RPC_VERSION,
      method: 'notifications/initialized',
    });

    await server.processIncomingMessage(connection, {
      jsonrpc: JSON_RPC_VERSION,
      id: 2,
      method: 'tools/list',
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      jsonrpc: JSON_RPC_VERSION,
      id: 2,
      result: {
        tools: expect.arrayContaining([
          expect.objectContaining({ name: 'bboard_create_session' }),
          expect.objectContaining({ name: 'bboard_set_admin_secret' }),
        ]),
      },
    });
  });

  it('can skip initialize when configured', async () => {
    const sessions = createSessions();
    const server = new BBoardMcpServer(new NoopTransport(), { requireInitialize: false }, sessions);
    const { connection, messages } = createConnection();

    await server.processIncomingMessage(connection, {
      jsonrpc: JSON_RPC_VERSION,
      id: 3,
      method: 'resources/list',
    });

    expect(messages[0]).toMatchObject({
      id: 3,
      result: {
        resources: expect.arrayContaining([
          expect.objectContaining({ uri: 'docs://agent-workflow' }),
          expect.objectContaining({ uri: 'docs://credential-model' }),
        ]),
      },
    });
  });

  it('delegates tool calls to the session service', async () => {
    const sessions = createSessions();
    const server = new BBoardMcpServer(new NoopTransport(), { requireInitialize: false }, sessions);
    const { connection, messages } = createConnection();

    await server.processIncomingMessage(connection, {
      jsonrpc: JSON_RPC_VERSION,
      id: 4,
      method: 'tools/call',
      params: {
        name: 'bboard_create_session',
        arguments: {
          network: 'preview',
        },
      },
    });

    expect(sessions.createSession).toHaveBeenCalledWith({ network: 'preview', sessionId: undefined, walletSeed: undefined, agentSecretKey: undefined, adminSecret: undefined });
    expect(messages[0]).toMatchObject({
      id: 4,
      result: {
        structuredContent: expect.objectContaining({
          sessionId: 's1',
          hasAdminSecret: false,
        }),
      },
    });
  });

  it('returns the operator prompt', async () => {
    const sessions = createSessions();
    const server = new BBoardMcpServer(new NoopTransport(), { requireInitialize: false }, sessions);
    const { connection, messages } = createConnection();

    await server.processIncomingMessage(connection, {
      jsonrpc: JSON_RPC_VERSION,
      id: 5,
      method: 'prompts/get',
      params: {
        name: 'bboard_operator',
      },
    });

    expect(messages[0]).toMatchObject({
      id: 5,
      result: {
        description: 'Operational prompt for a bulletin-board agent',
      },
    });
  });
});
