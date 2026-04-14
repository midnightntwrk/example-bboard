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

import type { ContractAddress, SigningKey } from '@midnight-ntwrk/compact-runtime';
import {
  type ExportPrivateStatesOptions,
  type ExportSigningKeysOptions,
  type ImportPrivateStatesOptions,
  type ImportPrivateStatesResult,
  type ImportSigningKeysOptions,
  type ImportSigningKeysResult,
  type PrivateStateExport,
  type PrivateStateId,
  type PrivateStateProvider,
  type SigningKeyExport,
} from '@midnight-ntwrk/midnight-js-types';

/**
 * A simple in-memory implementation of private state provider. Makes it easy to capture and rewrite private state from deploy.
 * @template PSI - Type of the private state identifier.
 * @template PS - Type of the private state.
 * @returns {PrivateStateProvider<PSI, PS>} An in-memory private state provider.
 */
export const inMemoryPrivateStateProvider = <PSI extends PrivateStateId, PS = unknown>(): PrivateStateProvider<
  PSI,
  PS
> => {
  const privateStates = new Map<ContractAddress, Map<PSI, PS>>();
  const signingKeys = new Map<ContractAddress, SigningKey>();
  let contractAddress: ContractAddress | null = null;

  const requireContractAddress = (): ContractAddress => {
    if (contractAddress === null) {
      throw new Error('Contract address not set. Call setContractAddress() before accessing private state.');
    }
    return contractAddress;
  };

  const getScopedStates = (address: ContractAddress): Map<PSI, PS> => {
    let scopedStates = privateStates.get(address);
    if (!scopedStates) {
      scopedStates = new Map<PSI, PS>();
      privateStates.set(address, scopedStates);
    }
    return scopedStates;
  };

  const encode = <T>(value: T): string => JSON.stringify(value);

  const decode = <T>(value: string): T => JSON.parse(value) as T;

  const exportPrivateStatePayload = (address: ContractAddress): Record<string, string> =>
    Object.fromEntries(
      Array.from(getScopedStates(address).entries()).map(([stateId, value]) => [stateId, encode(value)]),
    );

  const exportSigningKeyPayload = (): Record<ContractAddress, SigningKey> => Object.fromEntries(signingKeys.entries());

  return {
    setContractAddress(address: ContractAddress): void {
      contractAddress = address;
    },
    /**
     * Sets the private state for a given key.
     * @param {PSI} key - The key for the private state.
     * @param {PS} state - The private state to set.
     * @returns {Promise<void>} A promise that resolves when the state is set.
     */
    set(key: PSI, state: PS): Promise<void> {
      getScopedStates(requireContractAddress()).set(key, state);
      return Promise.resolve();
    },
    /**
     * Gets the private state for a given key.
     * @param {PSI} key - The key for the private state.
     * @returns {Promise<PS | null>} A promise that resolves to the private state or null if not found.
     */
    get(key: PSI): Promise<PS | null> {
      const value = getScopedStates(requireContractAddress()).get(key) ?? null;
      return Promise.resolve(value);
    },
    /**
     * Removes the private state for a given key.
     * @param {PSI} key - The key for the private state.
     * @returns {Promise<void>} A promise that resolves when the state is removed.
     */
    remove(key: PSI): Promise<void> {
      getScopedStates(requireContractAddress()).delete(key);
      return Promise.resolve();
    },
    /**
     * Clears all private states.
     * @returns {Promise<void>} A promise that resolves when all states are cleared.
     */
    clear(): Promise<void> {
      privateStates.delete(requireContractAddress());
      return Promise.resolve();
    },
    /**
     * Sets the signing key for a given contract address.
     * @param {ContractAddress} contractAddress - The contract address.
     * @param {SigningKey} signingKey - The signing key to set.
     * @returns {Promise<void>} A promise that resolves when the signing key is set.
     */
    setSigningKey(contractAddress: ContractAddress, signingKey: SigningKey): Promise<void> {
      signingKeys.set(contractAddress, signingKey);
      return Promise.resolve();
    },
    /**
     * Gets the signing key for a given contract address.
     * @param {ContractAddress} contractAddress - The contract address.
     * @returns {Promise<SigningKey | null>} A promise that resolves to the signing key or null if not found.
     */
    getSigningKey(contractAddress: ContractAddress): Promise<SigningKey | null> {
      const value = signingKeys.get(contractAddress) ?? null;
      return Promise.resolve(value);
    },
    /**
     * Removes the signing key for a given contract address.
     * @param {ContractAddress} contractAddress - The contract address.
     * @returns {Promise<void>} A promise that resolves when the signing key is removed.
     */
    removeSigningKey(contractAddress: ContractAddress): Promise<void> {
      signingKeys.delete(contractAddress);
      return Promise.resolve();
    },
    /**
     * Clears all signing keys.
     * @returns {Promise<void>} A promise that resolves when all signing keys are cleared.
     */
    clearSigningKeys(): Promise<void> {
      signingKeys.clear();
      return Promise.resolve();
    },
    exportPrivateStates(options?: ExportPrivateStatesOptions): Promise<PrivateStateExport> {
      void options;
      const address = requireContractAddress();
      return Promise.resolve({
        format: 'midnight-private-state-export',
        encryptedPayload: encode({
          contractAddress: address,
          states: exportPrivateStatePayload(address),
        }),
        salt: 'in-memory-private-state-provider',
      });
    },
    importPrivateStates(
      exportData: PrivateStateExport,
      options?: ImportPrivateStatesOptions,
    ): Promise<ImportPrivateStatesResult> {
      const address = requireContractAddress();
      const conflictStrategy = options?.conflictStrategy ?? 'error';
      const payload = decode<{ contractAddress?: ContractAddress; states?: Record<string, string> }>(
        exportData.encryptedPayload,
      );
      const states = payload.states ?? {};
      const scopedStates = getScopedStates(address);
      let imported = 0;
      let skipped = 0;
      let overwritten = 0;

      for (const [rawStateId, serializedState] of Object.entries(states)) {
        const stateId = rawStateId as PSI;
        const hasExisting = scopedStates.has(stateId);
        if (hasExisting) {
          if (conflictStrategy === 'skip') {
            skipped += 1;
            continue;
          }
          if (conflictStrategy === 'error') {
            return Promise.reject(new Error(`Private state conflict for '${stateId}'`));
          }
          overwritten += 1;
        } else {
          imported += 1;
        }
        scopedStates.set(stateId, decode<PS>(serializedState));
      }

      return Promise.resolve({ imported, skipped, overwritten });
    },
    exportSigningKeys(options?: ExportSigningKeysOptions): Promise<SigningKeyExport> {
      void options;
      return Promise.resolve({
        format: 'midnight-signing-key-export',
        encryptedPayload: encode({
          keys: exportSigningKeyPayload(),
        }),
        salt: 'in-memory-signing-key-provider',
      });
    },
    importSigningKeys(
      exportData: SigningKeyExport,
      options?: ImportSigningKeysOptions,
    ): Promise<ImportSigningKeysResult> {
      const conflictStrategy = options?.conflictStrategy ?? 'error';
      const payload = decode<{ keys?: Record<ContractAddress, SigningKey> }>(exportData.encryptedPayload);
      const keys = payload.keys ?? {};
      let imported = 0;
      let skipped = 0;
      let overwritten = 0;

      for (const [address, signingKey] of Object.entries(keys)) {
        const hasExisting = signingKeys.has(address);
        if (hasExisting) {
          if (conflictStrategy === 'skip') {
            skipped += 1;
            continue;
          }
          if (conflictStrategy === 'error') {
            return Promise.reject(new Error(`Signing key conflict for '${address}'`));
          }
          overwritten += 1;
        } else {
          imported += 1;
        }
        signingKeys.set(address, signingKey);
      }

      return Promise.resolve({ imported, skipped, overwritten });
    },
  };
};
