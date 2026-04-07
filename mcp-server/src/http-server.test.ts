import http from 'node:http';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { createHttpHandler } from './http-server.js';
import { JSON_RPC_VERSION, type JsonRpcMessage } from './protocol.js';
import { type McpConnection } from './transports.js';

class MockRequest extends Readable {
  method?: string;
  url?: string;
  headers: http.IncomingHttpHeaders;
  socket: { remoteAddress?: string };

  constructor(method: string, url: string, body = '', headers: http.IncomingHttpHeaders = {}) {
    super();
    this.method = method;
    this.url = url;
    this.headers = headers;
    this.socket = { remoteAddress: '127.0.0.1' };
    this.push(body);
    this.push(null);
  }

  override _read(): void {}
}

class MockResponse {
  statusCode?: number;
  headers?: Record<string, string>;
  body = '';

  writeHead(statusCode: number, headers: Record<string, string>) {
    this.statusCode = statusCode;
    this.headers = headers;
    return this;
  }

  end(body?: string) {
    this.body = body ?? '';
    return this;
  }
}

const defaultOnMessage = async (connection: McpConnection): Promise<void> => {
  connection.send({
    jsonrpc: JSON_RPC_VERSION,
    id: 1,
    result: { ok: true },
  } as JsonRpcMessage);
};

const createHandler = (onMessage: (connection: McpConnection, message: JsonRpcMessage) => Promise<void> = defaultOnMessage) =>
  createHttpHandler({
    host: '127.0.0.1',
    port: 8787,
    log: vi.fn(),
    onMessage,
  });

describe('createHttpHandler', () => {
  it('serves health checks', async () => {
    const handler = createHandler();
    const response = new MockResponse();

    await handler(new MockRequest('GET', '/health') as unknown as http.IncomingMessage, response as unknown as http.ServerResponse);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ ok: true, transport: 'http' });
  });

  it('accepts POST /mcp requests', async () => {
    const onMessage = vi.fn(async (connection: McpConnection, message: JsonRpcMessage) => {
      expect(message).toMatchObject({ method: 'tools/list' });
      connection.send({ jsonrpc: JSON_RPC_VERSION, id: 1, result: { ok: true } } as JsonRpcMessage);
    });
    const handler = createHandler(onMessage);
    const response = new MockResponse();

    await handler(
      new MockRequest('POST', '/mcp', '{"jsonrpc":"2.0","id":1,"method":"tools/list"}', {
        host: '127.0.0.1:8787',
        'content-type': 'application/json',
      }) as unknown as http.IncomingMessage,
      response as unknown as http.ServerResponse,
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ id: 1, result: { ok: true } });
  });

  it('accepts POST / and /mcp/ as RPC endpoints', async () => {
    for (const path of ['/', '/mcp/']) {
      const handler = createHandler();
      const response = new MockResponse();

      await handler(
        new MockRequest('POST', path, '{"jsonrpc":"2.0","id":1,"method":"tools/list"}') as unknown as http.IncomingMessage,
        response as unknown as http.ServerResponse,
      );

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toMatchObject({ id: 1, result: { ok: true } });
    }
  });

  it('returns 404 for unknown paths', async () => {
    const handler = createHandler();
    const response = new MockResponse();

    await handler(new MockRequest('POST', '/nope', '{}') as unknown as http.IncomingMessage, response as unknown as http.ServerResponse);

    expect(response.statusCode).toBe(404);
  });

  it('handles preflight requests', async () => {
    const handler = createHandler();
    const response = new MockResponse();

    await handler(new MockRequest('OPTIONS', '/mcp') as unknown as http.IncomingMessage, response as unknown as http.ServerResponse);

    expect(response.statusCode).toBe(204);
  });

  it('returns 400 on invalid JSON bodies', async () => {
    const handler = createHandler();
    const response = new MockResponse();

    await handler(new MockRequest('POST', '/mcp', '{bad json') as unknown as http.IncomingMessage, response as unknown as http.ServerResponse);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toMatchObject({
      jsonrpc: JSON_RPC_VERSION,
      id: null,
    });
  });
});
