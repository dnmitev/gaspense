import { describe, expect, it } from "vitest";
import { carOptionLabel, resolveQuickAddTarget } from "@/lib/quick-add";

/**
 * The car-resolution rule for the car-agnostic add route.
 *
 * Database-free, like every other unit test here — `lib/quick-add.ts` imports
 * nothing.
 */

const car = (id: string) => ({ id });

describe("resolveQuickAddTarget", () => {
  it("reports no cars distinctly, rather than as an empty id", () => {
    // The shape matters: an earlier version returned an empty-string default,
    // and an empty string is exactly what a caller passes into a query by
    // accident while believing it holds an id.
    expect(resolveQuickAddTarget([])).toEqual({ kind: "no-cars" });
  });

  it("uses the only car and asks nothing when there is one", () => {
    expect(resolveQuickAddTarget([car("a")])).toEqual({ kind: "single", carId: "a" });
  });

  it("asks when there are two, defaulting to the first", () => {
    expect(resolveQuickAddTarget([car("a"), car("b")])).toEqual({
      kind: "choose",
      defaultCarId: "a",
    });
  });

  it("asks when there are five, still defaulting to the first", () => {
    const cars = ["a", "b", "c", "d", "e"].map(car);
    expect(resolveQuickAddTarget(cars)).toEqual({ kind: "choose", defaultCarId: "a" });
  });

  it("takes the caller's order as given — first means newest", () => {
    // `listActiveCars` orders createdAt: "desc", so "first" is "most recently
    // added". This function must not re-sort: if that ordering ever changes, the
    // default changes with it, and that is the intended coupling.
    expect(resolveQuickAddTarget([car("newest"), car("older")])).toEqual({
      kind: "choose",
      defaultCarId: "newest",
    });
  });
});

describe("carOptionLabel", () => {
  it("uses the plate alone when there is no nickname", () => {
    expect(carOptionLabel({ licensePlate: "DEMO-0001", nickname: null })).toBe("DEMO-0001");
  });

  it("leads with the nickname when there is one", () => {
    // The plate stays, because two cars can share a nickname and the plate is
    // what distinguishes them.
    expect(carOptionLabel({ licensePlate: "DEMO-0001", nickname: "Demo car" })).toBe(
      "Demo car · DEMO-0001",
    );
  });

  it("treats a missing nickname the same as null", () => {
    expect(carOptionLabel({ licensePlate: "DEMO-0002" })).toBe("DEMO-0002");
  });
});
