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

// import { webcrypto } from 'crypto';

import { type WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { UtxoWithMeta as UtxoWithMetaDust } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { createKeystore, UnshieldedWalletState } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { Logger } from 'pino';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import * as rx from 'rxjs';

export const getUnshieldedSeed = (seed: string): Uint8Array<ArrayBufferLike> => {
  const seedBuffer = Buffer.from(seed, 'hex');
  const hdWalletResult = HDWallet.fromSeed(seedBuffer);

  const { hdWallet } = hdWalletResult as {
    type: 'seedOk';
    hdWallet: HDWallet;
  };

  const derivationResult = hdWallet.selectAccount(0).selectRole(Roles.NightExternal).deriveKeyAt(0);

  if (derivationResult.type === 'keyOutOfBounds') {
    throw new Error('Key derivation out of bounds');
  }

  return derivationResult.key;
};

export const generateDust = async (
  logger: Logger,
  walletSeed: string,
  unshieldedState: UnshieldedWalletState,
  walletFacade: WalletFacade,
) => {
  const ttlIn10min = new Date(Date.now() + 10 * 60 * 1000);
  const dustState = await walletFacade.dust.waitForSyncedState();
  const networkId = getNetworkId();
  const unshieldedKeystore = createKeystore(getUnshieldedSeed(walletSeed), networkId);
  const utxos: UtxoWithMetaDust[] = unshieldedState.availableCoins
    .filter((coin) => !coin.meta.registeredForDustGeneration)
    .map((utxo) => ({ ...utxo.utxo, ctime: new Date(utxo.meta.ctime) }));

  if (utxos.length === 0) {
    logger.info('No unregistered UTXOs found for dust generation.');
    return;
  }

  logger.info(`Generating dust with ${utxos.length} UTXOs...`);

  const registerForDustTransaction = await walletFacade.dust.createDustGenerationTransaction(
    new Date(),
    ttlIn10min,
    utxos,
    unshieldedKeystore.getPublicKey(),
    dustState.dustAddress,
  );

  const intent = registerForDustTransaction.intents?.get(1);
  const intentSignatureData = intent!.signatureData(1);
  const signature = unshieldedKeystore.signData(intentSignatureData);
  const recipe = await walletFacade.dust.addDustGenerationSignature(registerForDustTransaction, signature);

  const transaction = await walletFacade.finalizeTransaction(recipe);
  const txId = await walletFacade.submitTransaction(transaction);

  const dustBalance = await rx.firstValueFrom(
    walletFacade.state().pipe(
      rx.filter((s) => s.dust.walletBalance(new Date()) > 0n),
      rx.map((s) => s.dust.walletBalance(new Date())),
    ),
  );
  logger.info(`Dust generation transaction submitted with txId: ${txId}`);
  logger.info(`Receiver dust balance after generation: ${dustBalance}`);

  return txId;
};
