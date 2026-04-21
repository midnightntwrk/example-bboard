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

import { BBoardSimulator } from "./bboard-simulator.js";
import {
  NetworkId,
  setNetworkId,
} from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";
import { randomBytes } from "./utils.js";
import { State } from "../managed/bboard/contract/index.js";

setNetworkId("undeployed" as NetworkId);

describe("BBoard smart contract", () => {
  it("generates initial ledger state deterministically", () => {
    const key = randomBytes(32);
    const simulator0 = new BBoardSimulator(key);
    const simulator1 = new BBoardSimulator(key);
    expect(simulator0.getLedger()).toEqual(simulator1.getLedger());
  });

  it("properly initializes ledger state and private state", () => {
    const key = randomBytes(32);
    const simulator = new BBoardSimulator(key);
    const initialLedgerState = simulator.getLedger();
    expect(initialLedgerState.sequence).toEqual(1n);
    expect(initialLedgerState.message.is_some).toEqual(false);
    expect(initialLedgerState.message.value).toEqual("");
    expect(initialLedgerState.owner).toEqual(new Uint8Array(32));
    expect(initialLedgerState.state).toEqual(State.VACANT);
    expect(initialLedgerState.postTimestamp).toEqual(0n);
    const initialPrivateState = simulator.getPrivateState();
    expect(initialPrivateState).toEqual({ secretKey: key });
  });

  it("lets you set a message", () => {
    const simulator = new BBoardSimulator(randomBytes(32));
    const initialPrivateState = simulator.getPrivateState();
    const nowSecs = simulator.getLedger().postTimestamp + 60n;
    const message =
      "Szeth-son-son-Vallano, Truthless of Shinovar, wore white on the day he was to kill a king";
    simulator.post(message, nowSecs);
    // the private ledger state shouldn't change
    expect(initialPrivateState).toEqual(simulator.getPrivateState());
    // And all the correct things should have been updated in the public ledger state
    const ledgerState = simulator.getLedger();
    expect(ledgerState.sequence).toEqual(1n);
    expect(ledgerState.message.is_some).toEqual(true);
    expect(ledgerState.message.value).toEqual(message);
    expect(ledgerState.owner).toEqual(simulator.publicKey());
    expect(ledgerState.state).toEqual(State.OCCUPIED);
    expect(ledgerState.postTimestamp).toEqual(nowSecs + 180n);
  });

  it("lets you take down a message", () => {
    const simulator = new BBoardSimulator(randomBytes(32));
    const initialPrivateState = simulator.getPrivateState();
    const initialPublicKey = simulator.publicKey();
    const nowSecs = simulator.getLedger().postTimestamp + 60n;
    const message =
      "Prince Raoden of Arelon awoke early that morning, completely unaware that he had been damned for all eternity.";
    simulator.post(message, nowSecs);
    simulator.takeDown();
    // the private ledger state shouldn't change
    expect(initialPrivateState).toEqual(simulator.getPrivateState());
    // And all the correct things should have been updated in the public ledger state
    const ledgerState = simulator.getLedger();
    expect(ledgerState.sequence).toEqual(2n);
    expect(ledgerState.message.is_some).toEqual(false);
    expect(ledgerState.message.value).toEqual("");
    // Technically the circuit doesn't clear the previous owner
    expect(ledgerState.owner).toEqual(initialPublicKey);
    expect(ledgerState.state).toEqual(State.VACANT);
    expect(ledgerState.postTimestamp).toEqual(nowSecs + 180n);
  });

  it("lets you post another message after taking down the first", () => {
    const simulator = new BBoardSimulator(randomBytes(32));
    const initialPrivateState = simulator.getPrivateState();
    let nowSecs = simulator.getLedger().postTimestamp + 60n;
    simulator.post("Life before Death.", nowSecs);
    simulator.takeDown();
    const message = "Strength before Weakness.";
    nowSecs = simulator.getLedger().postTimestamp + 60n;
    simulator.post(message, nowSecs);
    // the private ledger state shouldn't change
    expect(initialPrivateState).toEqual(simulator.getPrivateState());
    // And all the correct things should have been updated in the public ledger state
    const ledgerState = simulator.getLedger();
    expect(ledgerState.sequence).toEqual(2n);
    expect(ledgerState.message.is_some).toEqual(true);
    expect(ledgerState.message.value).toEqual(message);
    expect(ledgerState.owner).toEqual(simulator.publicKey());
    expect(ledgerState.state).toEqual(State.OCCUPIED);
  });

  it("lets a different user post a message after taking down the first", () => {
    const simulator = new BBoardSimulator(randomBytes(32));
    let nowSecs = simulator.getLedger().postTimestamp + 60n;
    simulator.post(
      "Remember, the past need not become our future as well.",
      nowSecs,
    );
    simulator.takeDown();
    simulator.switchUser(randomBytes(32));
    const message = "Joy was more than just an absence of discomfort.";
    nowSecs = simulator.getLedger().postTimestamp + 60n;
    simulator.post(message, nowSecs);
    const ledgerState = simulator.getLedger();
    expect(ledgerState.sequence).toEqual(2n);
    expect(ledgerState.message.is_some).toEqual(true);
    expect(ledgerState.message.value).toEqual(message);
    expect(ledgerState.owner).toEqual(simulator.publicKey());
    expect(ledgerState.state).toEqual(State.OCCUPIED);
  });

  it("doesn't let the same user post twice", () => {
    const simulator = new BBoardSimulator(randomBytes(32));
    const nowSecs = simulator.getLedger().postTimestamp + 60n;
    simulator.post(
      "My name is Stephen Leeds, and I am perfectly sane. My hallucinations, however, are all quite mad.",
      nowSecs,
    );
    expect(() =>
      simulator.post(
        "You should know by now that I've already had greatness. I traded it for mediocrity and some measure of sanity.",
        nowSecs,
      ),
    ).toThrow("failed assert: Attempted to post to an occupied board");
  });

  it("doesn't let different users post twice", () => {
    const simulator = new BBoardSimulator(randomBytes(32));
    const nowSecs = simulator.getLedger().postTimestamp + 60n;
    simulator.post("Ash fell from the sky", nowSecs);
    simulator.switchUser(randomBytes(32));
    expect(() =>
      simulator.post("I am, unfortunately, the hero of ages.", nowSecs),
    ).toThrow("failed assert: Attempted to post to an occupied board");
  });

  it("doesn't let users take down someone elses posts", () => {
    const simulator = new BBoardSimulator(randomBytes(32));
    const nowSecs = simulator.getLedger().postTimestamp + 60n;
    simulator.post(
      "Sometimes a hypocrite is nothing more than a man in the process of changing.",
      nowSecs,
    );
    simulator.switchUser(randomBytes(32));
    expect(() => simulator.takeDown()).toThrow(
      "failed assert: Attempted to take down post, but not the current owner",
    );
  });
});
