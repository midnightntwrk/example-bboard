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

setNetworkId("undeployed" as NetworkId);

describe("BBoard multi-slot appointment contract", () => {
  it("generates initial ledger state deterministically", () => {
    const key = randomBytes(32);
    const simulator0 = new BBoardSimulator(key);
    const simulator1 = new BBoardSimulator(key);
    for (let i = 0n; i < 14n; i++) {
      expect(simulator0.getLedger().slots.lookup(i)).toEqual(
        simulator1.getLedger().slots.lookup(i),
      );
    }
  });

  it("starts with 14 vacant slots", () => {
    const key = randomBytes(32);
    const simulator = new BBoardSimulator(key);
    const ledgerState = simulator.getLedger();
    // pad(32, "0") in the constructor fills the first byte with the character "0" (48)
    const emptyOwner = new Uint8Array(32);
    emptyOwner[0] = 48;
    for (let i = 0n; i < 14n; i++) {
      const slot = ledgerState.slots.lookup(i);
      expect(slot.state).toEqual(false);
      expect(slot.message.is_some).toEqual(false);
      expect(slot.sequence).toEqual(0n);
      expect(slot.owner).toEqual(emptyOwner);
    }
    expect(simulator.getPrivateState()).toEqual({ secretKey: key });
  });

  // post: success case
  it("lets you book a slot", () => {
    const simulator = new BBoardSimulator(randomBytes(32));
    const initialPrivateState = simulator.getPrivateState();
    simulator.post(3n, "Haircut and color, 10am");
    // the private state shouldn't change
    expect(simulator.getPrivateState()).toEqual(initialPrivateState);
    const slot = simulator.getLedger().slots.lookup(3n);
    expect(slot.state).toEqual(true);
    expect(slot.message.is_some).toEqual(true);
    expect(slot.message.value).toEqual("Haircut and color, 10am");
    expect(slot.sequence).toEqual(0n);
    expect(slot.owner).toEqual(simulator.publicKey(3n));
  });

  // post: failure case (slot already booked)
  it("doesn't let the same user book a slot twice", () => {
    const simulator = new BBoardSimulator(randomBytes(32));
    simulator.post(0n, "Trim");
    expect(() => simulator.post(0n, "Another trim")).toThrow(
      "failed assert: Time slot is already booked",
    );
  });

  it("doesn't let a different user book an occupied slot", () => {
    const simulator = new BBoardSimulator(randomBytes(32));
    simulator.post(5n, "Blowout");
    simulator.switchUser(randomBytes(32));
    expect(() => simulator.post(5n, "Updo")).toThrow(
      "failed assert: Time slot is already booked",
    );
  });

  // post: failure case (slot limit)
  it("rejects a slot number that doesn't exist", () => {
    const simulator = new BBoardSimulator(randomBytes(32));
    expect(() => simulator.post(14n, "Too far")).toThrow(
      "failed assert: Time slot does not exist",
    );
    expect(() => simulator.post(64n, "Way too far")).toThrow(
      "failed assert: Time slot does not exist",
    );
  });

  // multiple users, multiple slots
  it("lets different users book different slots at the same time", () => {
    const simulator = new BBoardSimulator(randomBytes(32));
    simulator.post(0n, "Monday AM");
    const firstKey = simulator.publicKey(0n);

    simulator.switchUser(randomBytes(32));
    simulator.post(1n, "Monday PM");
    const secondKey = simulator.publicKey(1n);

    const ledgerState = simulator.getLedger();
    expect(ledgerState.slots.lookup(0n).message.value).toEqual("Monday AM");
    expect(ledgerState.slots.lookup(1n).message.value).toEqual("Monday PM");
    expect(ledgerState.slots.lookup(0n).owner).toEqual(firstKey);
    expect(ledgerState.slots.lookup(1n).owner).toEqual(secondKey);
    expect(firstKey).not.toEqual(secondKey);
  });

  // takeDown: success case
  it("lets the owner cancel their slot", () => {
    const simulator = new BBoardSimulator(randomBytes(32));
    const initialPrivateState = simulator.getPrivateState();
    simulator.post(2n, "Manicure");
    const ownerKey = simulator.publicKey(2n);
    simulator.takeDown(2n);
    expect(simulator.getPrivateState()).toEqual(initialPrivateState);
    const slot = simulator.getLedger().slots.lookup(2n);
    expect(slot.state).toEqual(false);
    expect(slot.message.is_some).toEqual(false);
    expect(slot.sequence).toEqual(1n);
    // The circuit doesn't clear the previous owner
    expect(slot.owner).toEqual(ownerKey);
  });

  it("only cancels the chosen slot and leaves the others alone", () => {
    const simulator = new BBoardSimulator(randomBytes(32));
    simulator.post(0n, "Slot zero");
    simulator.post(1n, "Slot one");
    simulator.takeDown(0n);
    const ledgerState = simulator.getLedger();
    expect(ledgerState.slots.lookup(0n).state).toEqual(false);
    expect(ledgerState.slots.lookup(1n).state).toEqual(true);
    expect(ledgerState.slots.lookup(1n).message.value).toEqual("Slot one");
    // Only the cancelled slot's sequence moves
    expect(ledgerState.slots.lookup(0n).sequence).toEqual(1n);
    expect(ledgerState.slots.lookup(1n).sequence).toEqual(0n);
  });

  // takeDown: failure cases
  it("doesn't let users cancel someone else's slot", () => {
    const simulator = new BBoardSimulator(randomBytes(32));
    simulator.post(4n, "Facial");
    simulator.switchUser(randomBytes(32));
    expect(() => simulator.takeDown(4n)).toThrow(
      "failed assert: You are not the owner of this appointment",
    );
  });

  it("doesn't let you cancel a vacant slot", () => {
    const simulator = new BBoardSimulator(randomBytes(32));
    expect(() => simulator.takeDown(7n)).toThrow(
      "failed assert: Time slot is already vacant",
    );
  });

  it("rejects cancelling a slot number that doesn't exist", () => {
    const simulator = new BBoardSimulator(randomBytes(32));
    expect(() => simulator.takeDown(14n)).toThrow(
      "failed assert: Time slot does not exist",
    );
  });

  // sequence behavior on slot reuse
  it("gives a rebooked slot a new owner key", () => {
    const secretKey = randomBytes(32);
    const simulator = new BBoardSimulator(secretKey);
    simulator.post(6n, "First booking");
    const firstKey = simulator.getLedger().slots.lookup(6n).owner;
    simulator.takeDown(6n);
    simulator.post(6n, "Second booking");
    const slot = simulator.getLedger().slots.lookup(6n);
    expect(slot.sequence).toEqual(1n);
    expect(slot.state).toEqual(true);
    expect(slot.message.value).toEqual("Second booking");
    // Same person, same secret key, but the new sequence changes the key
    expect(slot.owner).not.toEqual(firstKey);
    expect(slot.owner).toEqual(simulator.publicKey(6n));
  });

  it("lets a different user book a slot after it was cancelled", () => {
    const simulator = new BBoardSimulator(randomBytes(32));
    simulator.post(9n, "Original booking");
    simulator.takeDown(9n);
    simulator.switchUser(randomBytes(32));
    simulator.post(9n, "New client");
    const slot = simulator.getLedger().slots.lookup(9n);
    expect(slot.message.value).toEqual("New client");
    expect(slot.owner).toEqual(simulator.publicKey(9n));
  });
});
