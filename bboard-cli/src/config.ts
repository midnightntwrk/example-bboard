// This file is part of midnightntwrk/example-bboard.
// Copyright (C) Midnight Foundation
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
  readonly generateDust: boolean;
}

export const currentDir = path.resolve(new URL(import.meta.url).pathname, '..');

export class StandaloneConfig implements Config {
  getEnvironment(logger: Logger): TestEnvironment {
    return getTestEnvironment(logger) as TestEnvironment;
  }
  privateStateStoreName = 'bboard-private-state';
  logDir = path.resolve(currentDir, '..', 'logs', 'standalone', `${new Date().toISOString()}.log`);
  zkConfigPath = path.resolve(currentDir, '..', '..', 'contract', 'src', 'managed', 'bboard');
  generateDust = false;
}

export class PreviewRemoteConfig implements Config {
  getEnvironment(logger: Logger): TestEnvironment {
    setNetworkId('preview');
    return new PreviewTestEnvironment(logger);
  }
  privateStateStoreName = 'bboard-private-state';
  logDir = path.resolve(currentDir, '..', 'logs', 'preview-remote', `${new Date().toISOString()}.log`);
  zkConfigPath = path.resolve(currentDir, '..', '..', 'contract', 'src', 'managed', 'bboard');
  generateDust = true;
}

export class PreprodRemoteConfig implements Config {
  getEnvironment(logger: Logger): TestEnvironment {
    setNetworkId('preprod');
    return new PreprodTestEnvironment(logger);
  }
  privateStateStoreName = 'bboard-private-state';
  logDir = path.resolve(currentDir, '..', 'logs', 'preprod-remote', `${new Date().toISOString()}.log`);
  zkConfigPath = path.resolve(currentDir, '..', '..', 'contract', 'src', 'managed', 'bboard');
  generateDust = true;
}

export class PreviewTestEnvironment extends RemoteTestEnvironment {
  constructor(logger: Logger) {
    super(logger);
  }

  private getProofServerUrl(): string {
    const container = this.proofServerContainer as { getUrl(): string } | undefined;
    if (!container) {
      throw new Error('Proof server container is not available.');
    }
    return container.getUrl();
  }

  getEnvironmentConfiguration(): EnvironmentConfiguration {
    return {
      walletNetworkId: 'preview',
      networkId: 'preview',
      indexer: 'https://indexer.preview.midnight.network/api/v4/graphql',
      indexerWS: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
      node: 'https://rpc.preview.midnight.network',
      nodeWS: 'wss://rpc.preview.midnight.network',
      faucet: 'https://midnight-tmnight-preview.nethermind.dev/',
      proofServer: this.getProofServerUrl(),
    };
  }
}

export class PreprodTestEnvironment extends RemoteTestEnvironment {
  constructor(logger: Logger) {
    super(logger);
  }

  private getProofServerUrl(): string {
    const container = this.proofServerContainer as { getUrl(): string } | undefined;
    if (!container) {
      throw new Error('Proof server container is not available.');
    }
    return container.getUrl();
  }

  getEnvironmentConfiguration(): EnvironmentConfiguration {
    // The Preprod indexer and node RPC are served by Blockfrost and need a project token.
    const projectId = process.env.BLOCKFROST_PROJECT_ID?.trim();
    if (!projectId) {
      throw new Error('BLOCKFROST_PROJECT_ID is not set.');
    }
    const withBlockfrostKey = (url: string) => `${url}?project_id=${encodeURIComponent(projectId)}`;
    return {
      walletNetworkId: 'preprod',
      networkId: 'preprod',
      indexer: withBlockfrostKey('https://midnight-preprod.blockfrost.io/api/v0'),
      indexerWS: withBlockfrostKey('wss://midnight-preprod.blockfrost.io/api/v0/ws'),
      node: withBlockfrostKey('https://rpc.midnight-preprod.blockfrost.io'),
      nodeWS: withBlockfrostKey('wss://rpc.midnight-preprod.blockfrost.io'),
      faucet: 'https://midnight-tmnight-preprod.nethermind.dev/',
      proofServer: this.getProofServerUrl(),
    };
  }

  // testkit-js 4.1.1 drops the query string from its health-check URLs, so Blockfrost
  // rejects the indexer check for lack of a token. Run the checks with the token instead.
  healthCheck = async () => {
    this.logger.info('Performing env health check');
    const { node, indexer, proofServer } = this.getEnvironmentConfiguration();
    const checks = [
      ['node', node, '/health'],
      ['indexer', indexer, '/ready'],
      ['proof server', proofServer, '/health'],
    ] as const;
    for (const [name, baseUrl, path] of checks) {
      const url = new URL(baseUrl);
      url.pathname = path;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`The ${name} health check failed with HTTP ${response.status}.`);
      }
      this.logger.info(`Connected to ${name} ${url.origin}${url.pathname}: ${await response.text()}`);
    }
  };
}
