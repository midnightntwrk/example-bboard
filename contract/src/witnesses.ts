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

/*
 * This file defines the shape of the bulletin board's private state,
 * as well as the witness functions for the contract.
 *
 * The bulletin board now supports two roles:
 * - Agents: can submit posts and withdraw pending posts (via secretKey)
 * - Admin: can approve, reject, and unpublish posts (via adminSecret)
 */

import { Ledger } from "./managed/bboard/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/compact-runtime";

export type BBoardPrivateState = {
  readonly secretKey: Uint8Array;
  readonly adminSecret: Uint8Array;
};

export const createBBoardPrivateState = (
  secretKey: Uint8Array,
  adminSecret: Uint8Array,
) => ({
  secretKey,
  adminSecret,
});

/**
 * Witnesses provide access to the contract's private state.
 *
 * - localSecretKey: Returns the agent's secret key for deriving ownership proofs
 * - adminSecret: Returns the admin's secret key for authorization checks
 */
export const witnesses = {
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, BBoardPrivateState>): [
    BBoardPrivateState,
    Uint8Array,
  ] => [privateState, privateState.secretKey],

  adminSecret: ({
    privateState,
  }: WitnessContext<Ledger, BBoardPrivateState>): [
    BBoardPrivateState,
    Uint8Array,
  ] => [privateState, privateState.adminSecret],
};
