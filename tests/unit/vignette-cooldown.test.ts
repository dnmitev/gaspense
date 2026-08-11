import { describe, expect, it } from "vitest";
import { VIGNETTE_COOLDOWN_MS, vignetteCooldownRemaining } from "@/lib/vignette-checks";

/**
 * The cooldown, which IS this feature's rate limit.
 *
 * Takes `now` as an argument rather than reading the clock, so these tests need
 * no fake timers and the rule stays a pure function.
 */

const now = new Date("2026-08-11T12:00:00.000Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("vignetteCooldownRemaining", () => {
  it("allows a car that has never been checked", () => {
    expect(vignetteCooldownRemaining(null, now)).toBe(0);
    expect(vignetteCooldownRemaining(undefined, now)).toBe(0);
  });

  it("refuses immediately after a check, with the full window remaining", () => {
    expect(vignetteCooldownRemaining(now, now)).toBe(VIGNETTE_COOLDOWN_MS);
  });

  it("refuses part-way through, reporting what is left", () => {
    const oneHour = 60 * 60 * 1000;
    expect(vignetteCooldownRemaining(ago(oneHour), now)).toBe(VIGNETTE_COOLDOWN_MS - oneHour);
  });

  it("allows exactly at the boundary", () => {
    // The boundary is inclusive, so a check at exactly six hours is permitted
    // rather than requiring one more millisecond.
    expect(vignetteCooldownRemaining(ago(VIGNETTE_COOLDOWN_MS), now)).toBe(0);
  });

  it("allows after the window", () => {
    expect(vignetteCooldownRemaining(ago(VIGNETTE_COOLDOWN_MS + 1), now)).toBe(0);
  });

  it("refuses a future-dated last check rather than allowing it", () => {
    // Clock skew, or a row written by a machine running ahead. The safe direction
    // against a service we are trying not to hammer is to wait, not to proceed.
    const future = new Date(now.getTime() + 60_000);
    expect(vignetteCooldownRemaining(future, now)).toBe(VIGNETTE_COOLDOWN_MS);
  });

  it("is six hours", () => {
    // Pinned deliberately: a vignette's validity changes at most daily, and the
    // constant is the whole rate limit. A silent change to it is a change to how
    // hard this app can hit a government service.
    expect(VIGNETTE_COOLDOWN_MS).toBe(6 * 60 * 60 * 1000);
  });
});
