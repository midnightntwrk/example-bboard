import { BBoardSimulator } from "./bboard-simulator.js";
import { NetworkId, setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";
import { randomBytes } from "./utils.js";

setNetworkId("undeployed" as NetworkId);

describe("MANO anonymous check-in contract", () => {

  it("generates initial ledger state deterministically", () => {
    const key = randomBytes(32);
    const sim0 = new BBoardSimulator(key);
    const sim1 = new BBoardSimulator(key);
    expect(sim0.getLedger()).toEqual(sim1.getLedger());
  });

  it("properly initializes ledger state", () => {
    const sim = new BBoardSimulator(randomBytes(32));
    const state = sim.getLedger();
    expect(state.isEnrolled).toEqual(false);
    expect(state.isRevoked).toEqual(false);
    expect(state.isPaused).toEqual(false);
    expect(state.owner).toEqual(new Uint8Array(32));
  });

  it("enrolls a new participant successfully", () => {
    const sim = new BBoardSimulator(randomBytes(32));
    const state = sim.enroll("2026-05-15");
    expect(state.isEnrolled).toEqual(true);
    expect(state.isRevoked).toEqual(false);
    expect(state.owner).toEqual(sim.publicKey());
    expect(state.checkInDate.is_some).toEqual(true);
    expect(state.checkInDate.value).toEqual("2026-05-15");
  });

  it("records a check-in and increments milestone count", () => {
    const sim = new BBoardSimulator(randomBytes(32));
    sim.enroll("2026-05-15");
    const beforeCount = sim.getLedger().milestoneCount;
    const state = sim.checkIn("2026-05-16");
    expect(state.milestoneCount).toEqual(beforeCount + 1n);
    expect(state.checkInDate.value).toEqual("2026-05-16");
  });

  it("verifies milestone after sufficient check-ins", () => {
    const sim = new BBoardSimulator(randomBytes(32));
    sim.enroll("2026-05-15");
    sim.checkIn("2026-05-16");
    const currentCount = sim.getLedger().milestoneCount;
    expect(() => sim.verifyMilestone(currentCount)).not.toThrow();
  });

  it("revokes enrollment successfully", () => {
    const sim = new BBoardSimulator(randomBytes(32));
    sim.enroll("2026-05-15");
    const state = sim.revokeEnrollment();
    expect(state.isEnrolled).toEqual(true);
    expect(state.isRevoked).toEqual(true);
  });

  it("pauses and resumes the contract", () => {
    const sim = new BBoardSimulator(randomBytes(32));
    const paused = sim.pauseContract();
    expect(paused.isPaused).toEqual(true);
    const resumed = sim.resumeContract();
    expect(resumed.isPaused).toEqual(false);
  });

  it("does not allow enrolling twice", () => {
    const sim = new BBoardSimulator(randomBytes(32));
    sim.enroll("2026-05-15");
    expect(() => sim.enroll("2026-05-15")).toThrow("failed assert: already enrolled");
  });

  it("does not allow check-in without enrolling", () => {
    const sim = new BBoardSimulator(randomBytes(32));
    expect(() => sim.checkIn("2026-05-15")).toThrow("failed assert: not enrolled");
  });

  it("does not allow check-in with a different secret key", () => {
    const sim = new BBoardSimulator(randomBytes(32));
    sim.enroll("2026-05-15");
    sim.switchUser(randomBytes(32));
    expect(() => sim.checkIn("2026-05-16")).toThrow("failed assert: not the enrolled participant");
  });

  it("does not allow check-in after revocation", () => {
    const sim = new BBoardSimulator(randomBytes(32));
    sim.enroll("2026-05-15");
    sim.revokeEnrollment();
    expect(() => sim.checkIn("2026-05-16")).toThrow("failed assert: enrollment revoked");
  });

  it("does not allow enroll when contract is paused", () => {
    const sim = new BBoardSimulator(randomBytes(32));
    sim.pauseContract();
    expect(() => sim.enroll("2026-05-15")).toThrow("failed assert: contract is paused");
  });

  it("does not allow verifying a milestone that has not been reached", () => {
    const sim = new BBoardSimulator(randomBytes(32));
    sim.enroll("2026-05-15");
    sim.checkIn("2026-05-16");
    const wrongThreshold = sim.getLedger().milestoneCount + 1n;
    expect(() => sim.verifyMilestone(wrongThreshold)).toThrow("failed assert: milestone count does not match threshold");
  });
});
