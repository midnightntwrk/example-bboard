import * as fs from 'node:fs/promises';
import path from 'node:path';
import {
  JSON_RPC_VERSION,
  DEFAULT_PROTOCOL_VERSION,
  ErrorCodes,
  JsonRpcError,
  JsonRpcMessage,
  JsonRpcRequest,
  JsonValue,
  SUPPORTED_PROTOCOL_VERSIONS,
  asObject,
  asOptionalBoolean,
  asOptionalNumber,
  asOptionalString,
  asString,
  isJsonRpcNotification,
  isJsonRpcRequest,
  toJsonError,
} from './protocol.js';
import { type McpConnection, type McpTransport } from './transports.js';
import { BBoardSessionManager } from './session-manager.js';

type ToolHandler = (args: Record<string, unknown>) => Promise<JsonValue>;

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonValue;
  handler: ToolHandler;
};

const resolveDocsDir = async (): Promise<string> => {
  const candidates = [
    path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'docs'),
    path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..', 'docs'),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error('Could not locate MCP documentation directory');
};

const toToolResult = (structuredContent: JsonValue, text: string, isError = false): JsonValue => ({
  content: [{ type: 'text', text }],
  structuredContent,
  isError,
});

const stringify = (value: JsonValue): string => JSON.stringify(value, null, 2);

type BBoardMcpServerOptions = {
  requireInitialize?: boolean;
};

export class BBoardMcpServer {
  private readonly sessions = new BBoardSessionManager();
  private readonly initializedConnections = new Set<string>();
  private readonly requireInitialize: boolean;

  private readonly tools: ToolDefinition[] = [
    {
      name: 'bboard_create_session',
      description:
        'Create a reusable agent session. A session owns one wallet seed and one bulletin-board agent secret. Admin secret is optional write-only input.',
      inputSchema: {
        type: 'object',
        properties: {
          network: { type: 'string', enum: ['preview', 'preprod', 'standalone'], default: 'preview' },
          sessionId: { type: 'string' },
          walletSeed: { type: 'string', description: 'Optional 32-byte wallet seed in hex. Generated when omitted.' },
          agentSecretKey: {
            type: 'string',
            description: 'Optional 32-byte contract secret in hex for the posting agent. Generated when omitted.',
          },
          adminSecret: {
            type: 'string',
            description: 'Optional write-only 32-byte admin secret in hex. It is accepted but never returned by the server.',
          },
        },
        additionalProperties: false,
      },
      handler: async (args) =>
        await this.sessions.createSession({
          network: asOptionalString(args.network, 'network') as 'preview' | 'preprod' | 'standalone' | undefined,
          sessionId: asOptionalString(args.sessionId, 'sessionId'),
          walletSeed: asOptionalString(args.walletSeed, 'walletSeed'),
          agentSecretKey: asOptionalString(args.agentSecretKey, 'agentSecretKey'),
          adminSecret: asOptionalString(args.adminSecret, 'adminSecret'),
        }),
    },
    {
      name: 'bboard_get_session',
      description: 'Return the current non-admin credentials, wallet address, balance, and board binding for a session.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
        required: ['sessionId'],
        additionalProperties: false,
      },
      handler: async (args) => await this.sessions.getSessionSummary(asString(args.sessionId, 'sessionId')),
    },
    {
      name: 'bboard_set_admin_secret',
      description: 'Write-only admin secret setter for a session. The server never returns the admin secret.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          adminSecret: { type: 'string' },
        },
        required: ['sessionId', 'adminSecret'],
        additionalProperties: false,
      },
      handler: async (args) =>
        await this.sessions.setAdminSecret(
          asString(args.sessionId, 'sessionId'),
          asString(args.adminSecret, 'adminSecret'),
        ),
    },
    {
      name: 'bboard_wait_for_wallet_ready',
      description:
        'Sync the wallet for a session and, when applicable, register dust for Midnight transactions. Use this before sending transactions.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          timeoutMs: { type: 'number', minimum: 1_000 },
        },
        required: ['sessionId'],
        additionalProperties: false,
      },
      handler: async (args) =>
        await this.sessions.waitForWalletReady(
          asString(args.sessionId, 'sessionId'),
          asOptionalNumber(args.timeoutMs, 'timeoutMs'),
        ),
    },
    {
      name: 'bboard_deploy_board',
      description: 'Deploy a new bulletin-board contract using the identity stored in the session.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
        required: ['sessionId'],
        additionalProperties: false,
      },
      handler: async (args) => await this.sessions.deployBoard(asString(args.sessionId, 'sessionId')),
    },
    {
      name: 'bboard_join_board',
      description: 'Join an existing bulletin-board contract by contract address.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          contractAddress: { type: 'string' },
        },
        required: ['sessionId', 'contractAddress'],
        additionalProperties: false,
      },
      handler: async (args) =>
        await this.sessions.joinBoard(
          asString(args.sessionId, 'sessionId'),
          asString(args.contractAddress, 'contractAddress'),
        ),
    },
    {
      name: 'bboard_get_board_state',
      description: 'Read both derived state and raw ledger state for the board currently attached to the session.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
        required: ['sessionId'],
        additionalProperties: false,
      },
      handler: async (args) => await this.sessions.getBoardState(asString(args.sessionId, 'sessionId')),
    },
    {
      name: 'bboard_submit_post',
      description: 'Submit a post into the pending board as the current agent identity.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['sessionId', 'message'],
        additionalProperties: false,
      },
      handler: async (args) =>
        await this.sessions.submitPost(asString(args.sessionId, 'sessionId'), asString(args.message, 'message')),
    },
    {
      name: 'bboard_withdraw_pending',
      description: 'Withdraw the current pending post if the session owns it.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
        required: ['sessionId'],
        additionalProperties: false,
      },
      handler: async (args) => await this.sessions.withdrawPending(asString(args.sessionId, 'sessionId')),
    },
    {
      name: 'bboard_approve_pending',
      description: 'Approve the pending post as admin. This requires the correct admin secret in the session.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
        required: ['sessionId'],
        additionalProperties: false,
      },
      handler: async (args) => await this.sessions.approvePending(asString(args.sessionId, 'sessionId')),
    },
    {
      name: 'bboard_reject_pending',
      description: 'Reject the pending post as admin. This requires the correct admin secret in the session.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
        required: ['sessionId'],
        additionalProperties: false,
      },
      handler: async (args) => await this.sessions.rejectPending(asString(args.sessionId, 'sessionId')),
    },
    {
      name: 'bboard_unpublish_published',
      description: 'Unpublish the current published post as admin. This requires the correct admin secret in the session.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
        required: ['sessionId'],
        additionalProperties: false,
      },
      handler: async (args) => await this.sessions.unpublishPublished(asString(args.sessionId, 'sessionId')),
    },
    {
      name: 'bboard_close_session',
      description: 'Stop the wallet, shut down the local proof-server environment, and release session resources.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
        },
        required: ['sessionId'],
        additionalProperties: false,
      },
      handler: async (args) => await this.sessions.closeSession(asString(args.sessionId, 'sessionId')),
    },
  ];

  constructor(
    private readonly transport: McpTransport,
    options: BBoardMcpServerOptions = {},
  ) {
    this.requireInitialize = options.requireInitialize ?? true;
  }

  async start(): Promise<void> {
    await this.transport.listen(async (connection, message) => {
      await this.processIncomingMessage(connection, message);
    });
  }

  async shutdown(): Promise<void> {
    await this.sessions.closeAll();
    if (this.transport.close) {
      await this.transport.close();
    }
  }

  async processIncomingMessage(connection: McpConnection, message: JsonRpcMessage): Promise<void> {
    if (isJsonRpcRequest(message)) {
      await this.handleRequest(connection, message);
      return;
    }

    if (isJsonRpcNotification(message)) {
      await this.handleNotification(connection, message.method);
    }
  }

  private async handleRequest(connection: McpConnection, request: JsonRpcRequest): Promise<void> {
    try {
      if (
        this.requireInitialize &&
        !this.initializedConnections.has(connection.id) &&
        request.method !== 'initialize' &&
        request.method !== 'ping'
      ) {
        throw new JsonRpcError(ErrorCodes.invalidRequest, 'Server has not been initialized yet');
      }

      let result: JsonValue;
      switch (request.method) {
        case 'initialize':
          result = this.handleInitialize(request.params);
          break;
        case 'ping':
          result = {};
          break;
        case 'tools/list':
          result = { tools: this.tools.map(({ handler: _handler, ...tool }) => tool) };
          break;
        case 'tools/call':
          result = await this.handleToolCall(request.params);
          break;
        case 'resources/list':
          result = {
            resources: [
              {
                uri: 'docs://agent-workflow',
                name: 'Agent Workflow',
                description: 'Step-by-step instructions for using this bulletin board MCP server from an agent.',
                mimeType: 'text/markdown',
              },
              {
                uri: 'docs://credential-model',
                name: 'Credential Model',
                description: 'Explains the wallet seed, agent secret, and write-only admin secret handling used by this server.',
                mimeType: 'text/markdown',
              },
            ],
          };
          break;
        case 'resources/read':
          result = await this.handleReadResource(request.params);
          break;
        case 'prompts/list':
          result = {
            prompts: [
              {
                name: 'bboard_operator',
                description: 'Operating guide for an agent that needs to use the bulletin board safely.',
              },
            ],
          };
          break;
        case 'prompts/get':
          result = await this.handlePromptGet(request.params);
          break;
        default:
          throw new JsonRpcError(ErrorCodes.methodNotFound, `Unknown method '${request.method}'`);
      }

      connection.send({
        jsonrpc: JSON_RPC_VERSION,
        id: request.id,
        result,
      });
    } catch (error) {
      connection.send({
        jsonrpc: JSON_RPC_VERSION,
        id: request.id,
        error: toJsonError(error),
      });
    }
  }

  private async handleNotification(connection: McpConnection, method: string): Promise<void> {
    if (method === 'notifications/initialized') {
      this.initializedConnections.add(connection.id);
    }
  }

  private handleInitialize(params: unknown): JsonValue {
    const payload = asObject(params, 'Expected initialize params');
    const requestedVersion = asString(payload.protocolVersion, 'protocolVersion');
    const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion as (typeof SUPPORTED_PROTOCOL_VERSIONS)[number])
      ? requestedVersion
      : DEFAULT_PROTOCOL_VERSION;

    return {
      protocolVersion,
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
      serverInfo: {
        name: 'example-bboard-mcp-server',
        version: '0.1.0',
      },
      instructions:
        'Create a session first. Persist walletSeed, agentSecretKey, and contractAddress outside the server so the same identity can be reused later. Admin secret is write-only input and is never returned. Call bboard_wait_for_wallet_ready before sending transactions.',
    };
  }

  private async handleToolCall(params: unknown): Promise<JsonValue> {
    const payload = asObject(params, 'Expected tools/call params');
    const name = asString(payload.name, 'name');
    const args = asObject(payload.arguments ?? {}, "Expected 'arguments' to be an object");
    const tool = this.tools.find((candidate) => candidate.name === name);

    if (!tool) {
      throw new JsonRpcError(ErrorCodes.invalidParams, `Unknown tool '${name}'`);
    }

    try {
      const structuredContent = await tool.handler(args);
      return toToolResult(structuredContent, stringify(structuredContent));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown tool error';
      return toToolResult({ tool: name, error: message }, message, true);
    }
  }

  private async handleReadResource(params: unknown): Promise<JsonValue> {
    const payload = asObject(params, 'Expected resources/read params');
    const uri = asString(payload.uri, 'uri');

    let fileName: string;
    switch (uri) {
      case 'docs://agent-workflow':
        fileName = 'AGENT_WORKFLOW.md';
        break;
      case 'docs://credential-model':
        fileName = 'CREDENTIAL_MODEL.md';
        break;
      default:
        throw new JsonRpcError(ErrorCodes.invalidParams, `Unknown resource '${uri}'`);
    }

    const docsDir = await resolveDocsDir();
    const text = await fs.readFile(path.join(docsDir, fileName), 'utf8');
    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text,
        },
      ],
    };
  }

  private async handlePromptGet(params: unknown): Promise<JsonValue> {
    const payload = asObject(params, 'Expected prompts/get params');
    const name = asString(payload.name, 'name');
    const promptArgs = payload.arguments ? asObject(payload.arguments, "Expected 'arguments' to be an object") : {};

    if (name !== 'bboard_operator') {
      throw new JsonRpcError(ErrorCodes.invalidParams, `Unknown prompt '${name}'`);
    }

    const emphasizeModeration = asOptionalBoolean(promptArgs.emphasizeModeration, 'emphasizeModeration') ?? true;

    const promptText = [
      'Operate the bulletin board through MCP tools only.',
      'Start by calling bboard_create_session, then bboard_wait_for_wallet_ready.',
      'Persist walletSeed, agentSecretKey, and contractAddress after creation or deployment.',
      'Admin secret is write-only input. Provide it through bboard_create_session or bboard_set_admin_secret, but do not expect the server to ever return it.',
      'Use bboard_get_board_state before acting when you need current context.',
      emphasizeModeration
        ? 'Never call admin moderation tools unless you are explicitly using the correct write-only admin secret for that board.'
        : 'Admin moderation tools require the board admin secret as write-only input.',
    ].join(' ');

    return {
      description: 'Operational prompt for a bulletin-board agent',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: promptText,
          },
        },
      ],
    };
  }
}
