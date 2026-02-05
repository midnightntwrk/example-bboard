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

import { UnshieldedTokenType } from '@midnight-ntwrk/ledger-v7';
import { type WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { type UnshieldedWallet, UnshieldedWalletState } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import * as Rx from 'rxjs';

import { FaucetClient, type EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import { Logger } from 'pino';
import { UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

export const getInitialState = async (wallet: ShieldedWallet | UnshieldedWallet) => {
  if (wallet instanceof ShieldedWallet) {
    return Rx.firstValueFrom((wallet as ShieldedWallet).state);
  } else {
    return Rx.firstValueFrom((wallet as UnshieldedWallet).state);
  }
};

export const getInitialShieldedState = async (logger: Logger, wallet: ShieldedWallet) => {
  logger.info('Getting initial state of wallet...');
  return Rx.firstValueFrom(wallet.state);
};

export const getInitialUnshieldedState = async (logger: Logger, wallet: UnshieldedWallet) => {
  logger.info('Getting initial state of wallet...');
  return Rx.firstValueFrom(wallet.state);
};

export const syncWallet = (logger: Logger, wallet: WalletFacade, throttleTime = 2_000, timeout = 90_000) => {
  logger.info('Syncing wallet...');

  return Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.tap((state) => {
        logger.debug(
          `Wallet synced state emission: { shielded=${state.shielded.state.progress.isStrictlyComplete()}, unshielded=${state.unshielded.progress.isStrictlyComplete()}, dust=${state.dust.state.progress.isStrictlyComplete()} }`,
        );
      }),
      Rx.throttleTime(throttleTime),
      Rx.tap((state) => {
        const isSynced =
          state.shielded.state.progress.isStrictlyComplete() &&
          state.dust.state.progress.isStrictlyComplete() &&
          state.unshielded.progress?.isStrictlyComplete() === true;

        logger.debug(
          `Wallet synced state emission (synced=${isSynced}): { shielded=${state.shielded.state.progress.isStrictlyComplete()}, unshielded=${state.unshielded.progress.isStrictlyComplete()}, dust=${state.dust.state.progress.isStrictlyComplete()} }`,
        );
      }),
      Rx.filter(
        (state) =>
          state.shielded.state.progress.isStrictlyComplete() &&
          state.dust.state.progress.isStrictlyComplete() &&
          state.unshielded.progress.isStrictlyComplete() === true,
      ),
      Rx.tap(() => logger.info('Sync complete')),
      Rx.tap((state) => {
        const shieldedBalances = state.shielded.balances || {};
        const unshieldedBalances = state.unshielded.balances || {};
        const dustBalances = state.dust.walletBalance(new Date(Date.now())) || 0n;

        logger.info(
          `Wallet balances after sync - Shielded: ${JSON.stringify(shieldedBalances)}, Unshielded: ${JSON.stringify(unshieldedBalances)}, Dust: ${dustBalances}`,
        );
      }),
      Rx.timeout({
        each: timeout,
        with: () => Rx.throwError(() => new Error(`Wallet sync timeout after ${timeout}ms`)),
      }),
    ),
  );
};

export const waitForUnshieldedFunds = async (
  logger: Logger,
  wallet: WalletFacade,
  env: EnvironmentConfiguration,
  tokenType: UnshieldedTokenType,
  fundFromFaucet = false,
): Promise<UnshieldedWalletState> => {
  const initialState = await getInitialUnshieldedState(logger, wallet.unshielded);
  const unshieldedAddress = UnshieldedAddress.codec.encode(getNetworkId(), initialState.address);
  logger.info(`Using unshielded address: ${unshieldedAddress.toString()} waiting for funds...`);
  if (fundFromFaucet && env.faucet) {
    logger.info('Requesting tokens from faucet...');
    await new FaucetClient(env.faucet, logger).requestTokens(unshieldedAddress.toString());
  }
  const initialBalance = initialState.balances[tokenType.raw];
  if (initialBalance === undefined || initialBalance === 0n) {
    logger.info(`Your wallet initial balance is: 0 (not yet initialized)`);
    logger.info(`Waiting to receive tokens...`);
    const facadeState = await syncWallet(logger, wallet);
    return facadeState.unshielded;
  }
  return initialState;
};
