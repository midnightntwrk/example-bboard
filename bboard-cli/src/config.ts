// This file is part of midnightntwrk/example-counter.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import path from 'node:path';
import {
  EnvironmentConfiguration,
  getTestEnvironment,
  RemoteTestEnvironment,
  TestEnvironment,
} from '@midnight-ntwrk/testkit-js';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { Logger } from 'pino';

export interface Config {
  readonly privateStateStoreName: string;
  readonly logDir: string;
  readonly zkConfigPath: string;
  getEnvironment(logger: Logger): TestEnvironment;
  readonly requestFaucetTokens: boolean;
  readonly generateDust: boolean;
}

export const currentDir = path.resolve(new URL(import.meta.url).pathname, '..');

const getProofServerOverride = (network: 'preview' | 'preprod'): string | undefined => {
  const networkSpecific =
    network === 'preview' ? process.env.BBOARD_PREVIEW_PROOF_SERVER_URL : process.env.BBOARD_PREPROD_PROOF_SERVER_URL;
  const shared = process.env.BBOARD_PROOF_SERVER_URL;
  const override = networkSpecific ?? shared;

  return override && override !== '' ? override : undefined;
};

class ManualRemoteTestEnvironment extends TestEnvironment {
  constructor(
    logger: Logger,
    private readonly configuration: EnvironmentConfiguration,
  ) {
    super(logger);
    Object.defineProperty(this, 'envConfiguration', {
      value: configuration,
      writable: false,
      enumerable: true,
      configurable: true,
    });
  }

  async shutdown(): Promise<void> {
    return;
  }

  async start(): Promise<EnvironmentConfiguration> {
    return this.configuration;
  }

  async startMidnightWalletProviders(amount = 1): Promise<Awaited<ReturnType<TestEnvironment['getMidnightWalletProvider']>>[]> {
    return await Promise.all(Array.from({ length: amount }, async () => await this.getMidnightWalletProvider()));
  }

  getEnvironmentConfiguration(): EnvironmentConfiguration {
    return this.configuration;
  }
}

export class StandaloneConfig implements Config {
  getEnvironment(logger: Logger): TestEnvironment {
    return getTestEnvironment(logger) as TestEnvironment;
  }
  privateStateStoreName = 'bboard-private-state';
  logDir = path.resolve(currentDir, '..', 'logs', 'standalone', `${new Date().toISOString()}.log`);
  zkConfigPath = path.resolve(currentDir, '..', '..', 'contract', 'src', 'managed', 'bboard');
  requestFaucetTokens = false;
  generateDust = false;
}

export class PreviewRemoteConfig implements Config {
  getEnvironment(logger: Logger): TestEnvironment {
    setNetworkId('preview');
    const proofServerOverride = getProofServerOverride('preview');
    if (proofServerOverride) {
      return new ManualRemoteTestEnvironment(logger, {
        walletNetworkId: 'preview',
        networkId: 'preview',
        indexer: 'https://indexer.preview.midnight.network/api/v3/graphql',
        indexerWS: 'wss://indexer.preview.midnight.network/api/v3/graphql/ws',
        node: 'https://rpc.preview.midnight.network',
        nodeWS: 'wss://rpc.preview.midnight.network',
        faucet: 'https://faucet.preview.midnight.network/api/request-tokens',
        proofServer: proofServerOverride,
      });
    }
    return new PreviewTestEnvironment(logger);
  }
  privateStateStoreName = 'bboard-private-state';
  logDir = path.resolve(currentDir, '..', 'logs', 'preview-remote', `${new Date().toISOString()}.log`);
  zkConfigPath = path.resolve(currentDir, '..', '..', 'contract', 'src', 'managed', 'bboard');
  requestFaucetTokens = false; // Faucet not available via API, gives 500 error
  generateDust = true;
}

export class PreprodRemoteConfig implements Config {
  getEnvironment(logger: Logger): TestEnvironment {
    setNetworkId('preprod');
    const proofServerOverride = getProofServerOverride('preprod');
    if (proofServerOverride) {
      return new ManualRemoteTestEnvironment(logger, {
        walletNetworkId: 'preprod',
        networkId: 'preprod',
        indexer: 'https://indexer.preprod.midnight.network/api/v3/graphql',
        indexerWS: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
        node: 'https://rpc.preprod.midnight.network',
        nodeWS: 'wss://rpc.preprod.midnight.network',
        faucet: 'https://faucet.preprod.midnight.network/api/request-tokens',
        proofServer: proofServerOverride,
      });
    }
    return new PreprodTestEnvironment(logger);
  }
  privateStateStoreName = 'bboard-private-state';
  logDir = path.resolve(currentDir, '..', 'logs', 'preprod-remote', `${new Date().toISOString()}.log`);
  zkConfigPath = path.resolve(currentDir, '..', '..', 'contract', 'src', 'managed', 'bboard');
  requestFaucetTokens = false; // Faucet not available via API, gives 500 error
  generateDust = true;
}

export class PreviewTestEnvironment extends RemoteTestEnvironment {
  constructor(logger: Logger) {
    super(logger);
  }

  private getProofServerUrl(): string {
    const override = getProofServerOverride('preview');
    if (override) {
      return override;
    }

    const container = this.proofServerContainer as { getUrl(): string } | undefined;
    if (!container) {
      throw new Error('Proof server container is not available. Set BBOARD_PROOF_SERVER_URL to use an existing proof server.');
    }
    return container.getUrl();
  }

  getEnvironmentConfiguration(): EnvironmentConfiguration {
    return {
      walletNetworkId: 'preview',
      networkId: 'preview',
      indexer: 'https://indexer.preview.midnight.network/api/v3/graphql',
      indexerWS: 'wss://indexer.preview.midnight.network/api/v3/graphql/ws',
      node: 'https://rpc.preview.midnight.network',
      nodeWS: 'wss://rpc.preview.midnight.network',
      faucet: 'https://faucet.preview.midnight.network/api/request-tokens',
      proofServer: this.getProofServerUrl(),
    };
  }
}

export class PreprodTestEnvironment extends RemoteTestEnvironment {
  constructor(logger: Logger) {
    super(logger);
  }

  private getProofServerUrl(): string {
    const override = getProofServerOverride('preprod');
    if (override) {
      return override;
    }

    const container = this.proofServerContainer as { getUrl(): string } | undefined;
    if (!container) {
      throw new Error('Proof server container is not available. Set BBOARD_PROOF_SERVER_URL to use an existing proof server.');
    }
    return container.getUrl();
  }

  getEnvironmentConfiguration(): EnvironmentConfiguration {
    return {
      walletNetworkId: 'preprod',
      networkId: 'preprod',
      indexer: 'https://indexer.preprod.midnight.network/api/v3/graphql',
      indexerWS: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
      node: 'https://rpc.preprod.midnight.network',
      nodeWS: 'wss://rpc.preprod.midnight.network',
      faucet: 'https://faucet.preprod.midnight.network/api/request-tokens',
      proofServer: this.getProofServerUrl(),
    };
  }
}
