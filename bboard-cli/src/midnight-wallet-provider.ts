/*
 * This file is part of midnight-js.
 * Copyright (C) 2025 Midnight Foundation
 * SPDX-License-Identifier: Apache-2.0
 * Licensed under the Apache License, Version 2.0 (the "License");
 * You may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  type CoinPublicKey,
  DustSecretKey,
  type EncPublicKey,
  type FinalizedTransaction,
  LedgerParameters,
  type ShieldedCoinInfo,
  type UnprovenTransaction,
  ZswapSecretKeys,
} from '@midnight-ntwrk/ledger-v6';
import {
  type BalancedProvingRecipe,
  type MidnightProvider,
  type WalletProvider,
} from '@midnight-ntwrk/midnight-js-types';
import { ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';
import { type WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { Logger } from 'pino';

import { getInitialShieldedState } from './wallet-utils';
import { DustWalletOptions, EnvironmentConfiguration, FluentWalletBuilder } from '@midnight-ntwrk/testkit-js';
import { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';

/**
 * Provider class that implements wallet functionality for the Midnight network.
 * Handles transaction balancing, submission, and wallet state management.
 */
export class MidnightWalletProvider implements MidnightProvider, WalletProvider {
  logger: Logger;
  readonly env: EnvironmentConfiguration;
  readonly wallet: WalletFacade;
  readonly zswapSecretKeys: ZswapSecretKeys;
  readonly dustSecretKey: DustSecretKey;

  private constructor(
    logger: Logger,
    environmentConfiguration: EnvironmentConfiguration,
    wallet: WalletFacade,
    zswapSecretKeys: ZswapSecretKeys,
    dustSecretKey: DustSecretKey,
  ) {
    this.logger = logger;
    this.env = environmentConfiguration;
    this.wallet = wallet;
    this.zswapSecretKeys = zswapSecretKeys;
    this.dustSecretKey = dustSecretKey;
  }

  getCoinPublicKey(): CoinPublicKey {
    return this.zswapSecretKeys.coinPublicKey;
  }

  getEncryptionPublicKey(): EncPublicKey {
    return this.zswapSecretKeys.encryptionPublicKey;
  }

  async balanceTx(
    tx: UnprovenTransaction,
    _newCoins: ShieldedCoinInfo[],
    ttl: Date = ttlOneHour(),
  ): Promise<BalancedProvingRecipe> {
    return this.wallet.balanceTransaction(this.zswapSecretKeys, this.dustSecretKey, tx, ttl);
  }

  submitTx(tx: FinalizedTransaction): Promise<string> {
    return this.wallet.submitTransaction(tx);
  }

  // We do not wait for funds, it's done outside
  async start(): Promise<void> {
    this.logger.info('Starting wallet...');
    await this.wallet.start(this.zswapSecretKeys, this.dustSecretKey);
  }

  async stop(): Promise<void> {
    return this.wallet.stop();
  }

  static async build(logger: Logger, env: EnvironmentConfiguration, seed?: string): Promise<MidnightWalletProvider> {
    const DEFAULT_DUST_OPTIONS: DustWalletOptions = {
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead: 1_000n, // changed midnight-js code FROM 500_000_000_000_000_000n TO 1000n
      feeBlocksMargin: 5,
    };
    const dustOptions = {
      ...DEFAULT_DUST_OPTIONS,
    };
    if (env.walletNetworkId === NetworkId.NetworkId.Undeployed) {
      dustOptions['additionalFeeOverhead'] = 500_000_000_000_000_000n;
    }
    const builder = FluentWalletBuilder.forEnvironment(env).withDustOptions(dustOptions);
    const { wallet, seeds } = seed
      ? await builder.withSeed(seed).buildWithoutStarting()
      : await builder.withRandomSeed().buildWithoutStarting();

    const initialState = await getInitialShieldedState(logger, wallet.shielded);
    logger.info(
      `Your wallet seed is: ${seeds.masterSeed} and your address is: ${initialState.address.coinPublicKeyString()}`,
    );

    return new MidnightWalletProvider(
      logger,
      env,
      wallet,
      ZswapSecretKeys.fromSeed(seeds.shielded),
      DustSecretKey.fromSeed(seeds.dust),
    );
  }
}
