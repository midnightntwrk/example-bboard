import http from 'node:http';
import { stderr } from 'node:process';
import { startHttpServer as startConfiguredHttpServer } from './http-server.js';
import { BBoardMcpServer } from './server.js';
import { ProofServerManager } from './proof-server-manager.js';
import { StdioTransport } from './transports.js';

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

const startHttpServer = async (): Promise<void> => {
  httpServer = await startConfiguredHttpServer({
    host: options.host,
    port: options.port,
    log: logStderr,
    onMessage: async (connection, message) => {
      await server.processIncomingMessage(connection, message);
    },
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
