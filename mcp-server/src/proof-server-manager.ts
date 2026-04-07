import { spawn } from 'node:child_process';
import path from 'node:path';

type ProofServerManagerOptions = {
  url: string;
  autoStart: boolean;
  shutdownOnExit: boolean;
  stderrLog: (message: string, extra?: Record<string, unknown>) => void;
  startupTimeoutMs?: number;
  pollIntervalMs?: number;
  runCommand?: (command: string, args: string[], cwd: string) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
};

const ROOT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', '..');
const COMPOSE_FILE = path.join(ROOT_DIR, 'bboard-cli', 'proof-server-local.yml');

const runCommand = async (
  command: string,
  args: string[],
  cwd: string,
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'ignore',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });
  });
};

export class ProofServerManager {
  private startedByManager = false;

  constructor(private readonly options: ProofServerManagerOptions) {}

  get url(): string {
    return this.options.url;
  }

  async ensureReady(): Promise<void> {
    if (await this.isReachable()) {
      this.options.stderrLog('[proof-server] reachable', { url: this.options.url });
      return;
    }

    if (!this.options.autoStart) {
      this.options.stderrLog('[proof-server] unreachable', { url: this.options.url, autoStart: false });
      return;
    }

    this.options.stderrLog('[proof-server] starting docker compose', {
      url: this.options.url,
      composeFile: COMPOSE_FILE,
    });
    const runCompose = this.options.runCommand ?? runCommand;
    const sleep = this.options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    await runCompose('docker', ['compose', '-f', COMPOSE_FILE, 'up', '-d'], ROOT_DIR);
    this.startedByManager = true;

    const startupTimeoutMs = this.options.startupTimeoutMs ?? 60_000;
    const pollIntervalMs = this.options.pollIntervalMs ?? 1_000;
    const deadline = Date.now() + startupTimeoutMs;
    while (Date.now() < deadline) {
      if (await this.isReachable()) {
        this.options.stderrLog('[proof-server] ready', { url: this.options.url });
        return;
      }
      await sleep(pollIntervalMs);
    }

    throw new Error(`Proof server did not become reachable at ${this.options.url} within ${startupTimeoutMs}ms`);
  }

  async shutdown(): Promise<void> {
    if (!this.options.shutdownOnExit || !this.startedByManager) {
      return;
    }

    this.options.stderrLog('[proof-server] stopping docker compose', {
      composeFile: COMPOSE_FILE,
    });
    const runCompose = this.options.runCommand ?? runCommand;
    await runCompose('docker', ['compose', '-f', COMPOSE_FILE, 'down'], ROOT_DIR);
  }

  private async isReachable(): Promise<boolean> {
    try {
      const response = await fetch(this.options.url, {
        method: 'GET',
        redirect: 'manual',
      });
      return response.status < 500;
    } catch {
      return false;
    }
  }
}
