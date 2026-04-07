import http from 'node:http';
import { stderr } from 'node:process';
import { BBoardMcpServer } from './server.js';
import { JSON_RPC_VERSION, ErrorCodes, type JsonRpcMessage, type JsonRpcResponse, toJsonError } from './protocol.js';
import { ProofServerManager } from './proof-server-manager.js';
import { StdioTransport, type McpConnection } from './transports.js';

type LaunchOptions = {
  transport: 'stdio' | 'http';
  host: string;
  port: number;
  proofServerUrl: string;
  startProofServer: boolean;
  stopProofServerOnExit: boolean;
};

const parseArgs = (): LaunchOptions => {
  const args = process.argv.slice(2);
  const options: LaunchOptions = {
    transport: (process.env.BBOARD_MCP_TRANSPORT as 'stdio' | 'http' | undefined) ?? 'stdio',
    host: process.env.BBOARD_MCP_HOST ?? '127.0.0.1',
    port: Number.parseInt(process.env.BBOARD_MCP_PORT ?? '8787', 10),
    proofServerUrl: process.env.BBOARD_PROOF_SERVER_URL ?? 'http://127.0.0.1:6300',
    startProofServer:
      (process.env.BBOARD_MCP_START_PROOF_SERVER ?? '').toLowerCase() === '1' ||
      (process.env.BBOARD_MCP_START_PROOF_SERVER ?? '').toLowerCase() === 'true',
    stopProofServerOnExit:
      (process.env.BBOARD_MCP_STOP_PROOF_SERVER_ON_EXIT ?? '').toLowerCase() === '1' ||
      (process.env.BBOARD_MCP_STOP_PROOF_SERVER_ON_EXIT ?? '').toLowerCase() === 'true',
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--transport') {
      const value = args[index + 1];
      if (value === 'stdio' || value === 'http') {
        options.transport = value;
        index += 1;
      }
    } else if (arg === '--http') {
      options.transport = 'http';
    } else if (arg === '--host') {
      options.host = args[index + 1] ?? options.host;
      index += 1;
    } else if (arg === '--port') {
      const rawPort = Number.parseInt(args[index + 1] ?? '', 10);
      if (!Number.isNaN(rawPort)) {
        options.port = rawPort;
      }
      index += 1;
    } else if (arg === '--proof-server-url') {
      options.proofServerUrl = args[index + 1] ?? options.proofServerUrl;
      index += 1;
    } else if (arg === '--start-proof-server') {
      options.startProofServer = true;
    } else if (arg === '--stop-proof-server-on-exit') {
      options.stopProofServerOnExit = true;
    }
  }

  return options;
};

const options = parseArgs();
const server =
  options.transport === 'http'
    ? new BBoardMcpServer(new StdioTransport(), { requireInitialize: false })
    : new BBoardMcpServer(new StdioTransport());

let httpServer: http.Server | undefined;

const HTTP_ALLOWED_RPC_PATHS = new Set(['/', '/mcp', '/mcp/']);

const logStderr = (message: string, extra?: Record<string, unknown>): void => {
  const line = extra ? `${message} ${JSON.stringify(extra)}\n` : `${message}\n`;
  stderr.write(line);
};

const proofServerManager = new ProofServerManager({
  url: options.proofServerUrl,
  autoStart: options.startProofServer,
  shutdownOnExit: options.stopProofServerOnExit,
  stderrLog: logStderr,
});

process.env.BBOARD_PROOF_SERVER_URL = options.proofServerUrl;

const getRequestUrl = (request: http.IncomingMessage): URL => {
  const host = request.headers.host ?? `${options.host}:${options.port}`;
  const rawUrl = request.url ?? '/';
  try {
    return new URL(rawUrl, `http://${host}`);
  } catch {
    return new URL('/', `http://${host}`);
  }
};

const isRpcPath = (pathname: string): boolean => HTTP_ALLOWED_RPC_PATHS.has(pathname);

const readRequestBody = async (request: http.IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
};

const sendHttpJson = (response: http.ServerResponse, statusCode: number, body: JsonRpcResponse | Record<string, unknown>) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  response.end(JSON.stringify(body));
};

const startHttpServer = async (): Promise<void> => {
  httpServer = http.createServer(async (request, response) => {
    const requestUrl = getRequestUrl(request);
    const pathname = requestUrl.pathname;

    logStderr('[mcp-http] request', {
      method: request.method,
      url: request.url ?? '/',
      pathname,
      origin: request.headers.origin ?? null,
      userAgent: request.headers['user-agent'] ?? null,
    });

    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      });
      response.end();
      return;
    }

    if (request.method === 'GET' && pathname === '/health') {
      sendHttpJson(response, 200, {
        ok: true,
        transport: 'http',
        name: 'example-bboard-mcp-server',
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/') {
      sendHttpJson(response, 200, {
        ok: true,
        message: 'Use POST /mcp for JSON-RPC MCP requests. Use GET /health for health checks.',
      });
      return;
    }

    if (request.method !== 'POST' || !isRpcPath(pathname)) {
      logStderr('[mcp-http] 404', {
        method: request.method,
        url: request.url ?? '/',
        pathname,
      });
      sendHttpJson(response, 404, { ok: false, error: 'Not found' });
      return;
    }

    let replied = false;
    const connection: McpConnection = {
      id: request.socket.remoteAddress ? `http:${request.socket.remoteAddress}` : 'http',
      send: (message: JsonRpcMessage) => {
        replied = true;
        sendHttpJson(response, 200, message as JsonRpcResponse);
      },
    };

    try {
      const rawBody = await readRequestBody(request);
      logStderr('[mcp-http] body', { body: rawBody });
      const message = JSON.parse(rawBody) as JsonRpcMessage;
      await server.processIncomingMessage(connection, message);

      if (!replied) {
        response.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        response.end();
      }
    } catch (error) {
      logStderr('[mcp-http] error', {
        message: error instanceof Error ? error.message : 'Unknown error',
        url: request.url ?? '/',
      });
      const fallbackId = 'id' in (error as object) ? undefined : null;
      sendHttpJson(response, 400, {
        jsonrpc: JSON_RPC_VERSION,
        id: fallbackId,
        error: toJsonError(error ?? new Error(`Invalid request body`)),
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer?.on('error', reject);
    httpServer?.listen(options.port, options.host, () => resolve());
  });
};

const shutdown = async () => {
  if (httpServer) {
    await new Promise<void>((resolve, reject) => {
      httpServer?.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
  await server.shutdown();
  await proofServerManager.shutdown();
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown();
});

process.on('SIGTERM', () => {
  void shutdown();
});

if (options.transport === 'http') {
  logStderr('[mcp] starting', {
    transport: 'http',
    host: options.host,
    port: options.port,
    proofServerUrl: options.proofServerUrl,
    startProofServer: options.startProofServer,
  });
  await proofServerManager.ensureReady();
  await startHttpServer();
} else {
  logStderr('[mcp] starting', {
    transport: options.transport,
    host: null,
    port: null,
    proofServerUrl: options.proofServerUrl,
    startProofServer: options.startProofServer,
  });
  await proofServerManager.ensureReady();
  await server.start();
}
