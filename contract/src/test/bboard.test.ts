// This file is part of midnightntwrk/example-bboard.
// Capstone (Track A): Multi-Post Board — tests.
// SPDX-License-Identifier: Apache-2.0

import { BBoardSimulator } from "./bboard-simulator.js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";
import { randomBytes } from "./utils.js";

setNetworkId("undeployed");

describe("Multi-post BBoard", () => {
  it("starts empty", () => {
    const sim = new BBoardSimulator(randomBytes(32));
    const l = sim.getLedger();
    expect(l.posts.isEmpty()).toEqual(true);
    expect(l.posts.size()).toEqual(0n);
    expect(l.nextId).toEqual(0n);
  });

  it("stores a post's message and owner under id 0", () => {
    const key = randomBytes(32);
    const sim = new BBoardSimulator(key);
    const message = "first post";
    sim.post(message);

    const l = sim.getLedger();
    expect(l.posts.size()).toEqual(1n);
    expect(l.nextId).toEqual(1n);
    expect(l.posts.member(0n)).toEqual(true);
    expect(l.posts.lookup(0n).message).toEqual(message);
    expect(l.posts.lookup(0n).owner).toEqual(sim.ownerKeyForId(0n));
    // posting must not change the user's private state
    expect(sim.getPrivateState()).toEqual({ secretKey: key });
  });

  it("holds posts from multiple different users at once", () => {
    const userA = randomBytes(32);
    const userB = randomBytes(32);
    const sim = new BBoardSimulator(userA);

    sim.post("from A"); // id 0
    const ownerA = sim.ownerKeyForId(0n);

    sim.switchUser(userB);
    sim.post("from B"); // id 1
    const ownerB = sim.ownerKeyForId(1n);

    const l = sim.getLedger();
    expect(l.posts.size()).toEqual(2n);
    expect(l.posts.lookup(0n).message).toEqual("from A");
    expect(l.posts.lookup(1n).message).toEqual("from B");
    expect(l.posts.lookup(0n).owner).toEqual(ownerA);
    expect(l.posts.lookup(1n).owner).toEqual(ownerB);
    // two different users produce two different owner commitments
    expect(ownerA).not.toEqual(ownerB);
  });

  it("lets the owner take down their own post", () => {
    const sim = new BBoardSimulator(randomBytes(32));
    sim.post("temporary"); // id 0
    expect(sim.getLedger().posts.member(0n)).toEqual(true);

    sim.takeDown(0n);

    const l = sim.getLedger();
    expect(l.posts.member(0n)).toEqual(false);
    expect(l.posts.size()).toEqual(0n);
    expect(l.nextId).toEqual(1n); // ids are never reused
  });

  it("won't let a different user take down your post", () => {
    const sim = new BBoardSimulator(randomBytes(32));
    sim.post("mine"); // id 0
    sim.switchUser(randomBytes(32));
    expect(() => sim.takeDown(0n)).toThrow(
      "failed assert: Attempted to take down a post, but not its owner",
    );
  });

  it("won't let you take down a post that doesn't exist", () => {
    const sim = new BBoardSimulator(randomBytes(32));
    expect(() => sim.takeDown(99n)).toThrow(
      "failed assert: Attempted to take down a post that does not exist",
    );
  });

  it("enforces the maximum number of posts", () => {
    const sim = new BBoardSimulator(randomBytes(32));
    // maxPosts() returns 5
    for (let i = 0; i < 5; i++) {
      sim.post(`post ${i}`);
    }
    expect(sim.getLedger().posts.size()).toEqual(5n);
    expect(() => sim.post("one too many")).toThrow(
      "failed assert: Attempted to post to a full board",
    );
  });
});
