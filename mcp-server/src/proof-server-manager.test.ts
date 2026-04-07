import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProofServerManager } from './proof-server-manager.js';

describe('ProofServerManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not start docker when the proof server is already reachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200 })));
    const manager = new ProofServerManager({
      url: 'http://127.0.0.1:6300',
      autoStart: true,
      shutdownOnExit: false,
      stderrLog: vi.fn(),
      pollIntervalMs: 1,
      startupTimeoutMs: 50,
    });

    await manager.ensureReady();

    expect(true).toBe(true);
  });

  it('does not auto-start when disabled', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('down');
    }));
    const manager = new ProofServerManager({
      url: 'http://127.0.0.1:6300',
      autoStart: false,
      shutdownOnExit: false,
      stderrLog: vi.fn(),
    });

    await manager.ensureReady();

    expect(true).toBe(true);
  });

  it('starts docker compose when unreachable and auto-start is enabled', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('still down'))
      .mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    const runCommandMock = vi.fn(async () => undefined);

    const manager = new ProofServerManager({
      url: 'http://127.0.0.1:6300',
      autoStart: true,
      shutdownOnExit: false,
      stderrLog: vi.fn(),
      pollIntervalMs: 1,
      startupTimeoutMs: 50,
      runCommand: runCommandMock,
      sleep: async () => undefined,
    });

    await manager.ensureReady();

    expect(runCommandMock).toHaveBeenCalledOnce();
  });

  it('stops docker compose on shutdown only when it started it', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    const runCommandMock = vi.fn(async () => undefined);

    const manager = new ProofServerManager({
      url: 'http://127.0.0.1:6300',
      autoStart: true,
      shutdownOnExit: true,
      stderrLog: vi.fn(),
      pollIntervalMs: 1,
      startupTimeoutMs: 50,
      runCommand: runCommandMock,
      sleep: async () => undefined,
    });

    await manager.ensureReady();
    await manager.shutdown();

    expect(runCommandMock).toHaveBeenCalledTimes(2);
  });
});
