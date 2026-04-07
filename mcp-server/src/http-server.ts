import http from 'node:http';
import { JSON_RPC_VERSION, type JsonRpcMessage, type JsonRpcResponse, toJsonError } from './protocol.js';
import { type McpConnection } from './transports.js';

export type HttpServerOptions = {
  host: string;
  port: number;
  log: (message: string, extra?: Record<string, unknown>) => void;
  onMessage: (connection: McpConnection, message: JsonRpcMessage) => Promise<void>;
};

const HTTP_ALLOWED_RPC_PATHS = new Set(['/', '/mcp', '/mcp/']);

const getRequestUrl = (request: http.IncomingMessage, host: string, port: number): URL => {
  const requestHost = request.headers.host ?? `${host}:${port}`;
  const rawUrl = request.url ?? '/';
  try {
    return new URL(rawUrl, `http://${requestHost}`);
  } catch {
    return new URL('/', `http://${requestHost}`);
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

export const sendHttpJson = (
  response: http.ServerResponse,
  statusCode: number,
  body: JsonRpcResponse | Record<string, unknown>,
): void => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  response.end(JSON.stringify(body));
};

export const createHttpHandler =
  ({ host, port, log, onMessage }: HttpServerOptions) =>
  async (request: http.IncomingMessage, response: http.ServerResponse): Promise<void> => {
    const requestUrl = getRequestUrl(request, host, port);
    const pathname = requestUrl.pathname;

    log('[mcp-http] request', {
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
      log('[mcp-http] 404', {
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
      log('[mcp-http] body', { body: rawBody });
      const message = JSON.parse(rawBody) as JsonRpcMessage;
      await onMessage(connection, message);

      if (!replied) {
        response.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        response.end();
      }
    } catch (error) {
      log('[mcp-http] error', {
        message: error instanceof Error ? error.message : 'Unknown error',
        url: request.url ?? '/',
      });
      sendHttpJson(response, 400, {
        jsonrpc: JSON_RPC_VERSION,
        id: null,
        error: toJsonError(error ?? new Error('Invalid request body')),
      });
    }
  };

export const startHttpServer = async (options: HttpServerOptions): Promise<http.Server> => {
  const server = http.createServer(createHttpHandler(options));

  await new Promise<void>((resolve, reject) => {
    server.on('error', reject);
    server.listen(options.port, options.host, () => resolve());
  });

  return server;
};
