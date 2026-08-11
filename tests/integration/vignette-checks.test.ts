import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createCar, softDeleteCar } from "@/lib/cars";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import {
  getCarVignetteStatuses,
  getLastVignetteAttempt,
  recordVignetteCheck,
} from "@/lib/vignette-checks";
import type { VignetteResult } from "@/lib/vignette";
import { createTestClient, resetDatabase } from "./helpers";

/**
 * Vignette checks: ownership, and the two-different-latests rule.
 *
 * `VignetteCheck` has no `userId` — ownership runs `car → userId`, so a dropped
 * relation filter is not a type error but a query returning everyone's rows.
 * Every cross-user test re-reads the victim's data afterwards.
 */

const prisma: PrismaClient = createTestClient();

const carInput = {
  fuelType: "PETROL" as const,
  make: undefined,
  model: undefined,
  nickname: undefined,
  year: undefined,
};

const active = (validUntil: string): VignetteResult => ({
  kind: "active",
  validFrom: "2026-01-16T00:00:00",
  validUntil,
  vignetteNumber: "BGV0000000000001",
  exempt: false,
});

const none: VignetteResult = { kind: "none" };
const unavailable: VignetteResult = { kind: "unavailable", reason: "test: unreachable" };

async function fixtures() {
  const [alice, bob] = await Promise.all([
    prisma.user.create({ data: { email: "alice@example.test" } }),
    prisma.user.create({ data: { email: "bob@example.test" } }),
  ]);

  const [aliceCar, bobCar] = await Promise.all([
    createCar(alice.id, { ...carInput, licensePlate: "ALICE-01" }),
    createCar(bob.id, { ...carInput, licensePlate: "BOB-01" }),
  ]);

  return { alice, bob, aliceCar, bobCar };
}

/**
 * Writes a check at an explicit timestamp, so ordering is deterministic.
 *
 * `checkedAt` has a database default, but these tests need rows minutes or days
 * apart without sleeping, so it is set directly.
 */
function checkAt(carId: string, when: string, result: VignetteResult) {
  return prisma.vignetteCheck.create({
    data: {
      carId,
      checkedAt: new Date(when),
      outcome:
        result.kind === "active" ? "ACTIVE" : result.kind === "none" ? "NONE" : "UNAVAILABLE",
      validUntil:
        result.kind === "active" && result.validUntil ? new Date(result.validUntil) : null,
      exempt: result.kind === "active" ? result.exempt : null,
      failureReason: result.kind === "unavailable" ? result.reason : null,
    },
  });
}

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("recordVignetteCheck", () => {
  it("stores a result against the caller's own car", async () => {
    const { alice, aliceCar } = await fixtures();

    const result = await recordVignetteCheck(alice.id, aliceCar.id, active("2026-12-15T23:59:59"));

    expect(result.ok).toBe(true);
    const row = await prisma.vignetteCheck.findFirstOrThrow();
    expect(row.carId).toBe(aliceCar.id);
    expect(row.outcome).toBe("ACTIVE");
    expect(row.validUntil).not.toBeNull();
  });

  it("refuses another user's car, and writes nothing", async () => {
    const { alice, bobCar } = await fixtures();

    const result = await recordVignetteCheck(alice.id, bobCar.id, none);

    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(await prisma.vignetteCheck.count()).toBe(0);
  });

  it("refuses a soft-deleted car", async () => {
    // A soft-deleted car's expenses stop being reachable; its vignette stops
    // being checkable for the same reason.
    const { alice, aliceCar } = await fixtures();
    await softDeleteCar(alice.id, aliceCar.id);

    expect(await recordVignetteCheck(alice.id, aliceCar.id, none)).toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(await prisma.vignetteCheck.count()).toBe(0);
  });

  it("stores an UNAVAILABLE result with its reason", async () => {
    // Stored deliberately: it is what makes "we tried and failed" visible rather
    // than indistinguishable from "never checked".
    const { alice, aliceCar } = await fixtures();

    await recordVignetteCheck(alice.id, aliceCar.id, unavailable);

    const row = await prisma.vignetteCheck.findFirstOrThrow();
    expect(row.outcome).toBe("UNAVAILABLE");
    expect(row.failureReason).toContain("unreachable");
    expect(row.validUntil).toBeNull();
  });
});

describe("getCarVignetteStatuses", () => {
  it("returns nothing for another user's cars, leaving theirs intact", async () => {
    const { alice, bob, bobCar } = await fixtures();
    await recordVignetteCheck(bob.id, bobCar.id, active("2026-12-15T23:59:59"));

    expect(await getCarVignetteStatuses(alice.id)).toEqual([]);

    // Re-read as the owner: a function that always returned [] would satisfy the
    // assertion above on its own.
    expect(await getCarVignetteStatuses(bob.id)).toHaveLength(1);
  });

  it("takes the most recent check as the current status", async () => {
    const { alice, aliceCar } = await fixtures();
    await checkAt(aliceCar.id, "2026-08-01T10:00:00.000Z", none);
    await checkAt(aliceCar.id, "2026-08-09T10:00:00.000Z", active("2026-12-15T23:59:59"));

    const [status] = await getCarVignetteStatuses(alice.id);

    expect(status.latestResult?.outcome).toBe("ACTIVE");
  });

  it("⚠️ does NOT let a later UNAVAILABLE replace a known result", async () => {
    // The rule this whole shape exists for. An outage must not overwrite a
    // known-good ACTIVE and report itself as an expired vignette.
    const { alice, aliceCar } = await fixtures();
    await checkAt(aliceCar.id, "2026-08-09T10:00:00.000Z", active("2026-12-15T23:59:59"));
    await checkAt(aliceCar.id, "2026-08-10T10:00:00.000Z", unavailable);

    const [status] = await getCarVignetteStatuses(alice.id);

    expect(status.latestResult?.outcome).toBe("ACTIVE");
    expect(status.lastAttemptFailed).toBe(true);
    expect(status.lastAttemptAt?.toISOString()).toBe("2026-08-10T10:00:00.000Z");
  });

  it("reports a failed first attempt as failed, with no result", async () => {
    const { alice, aliceCar } = await fixtures();
    await checkAt(aliceCar.id, "2026-08-10T10:00:00.000Z", unavailable);

    const [status] = await getCarVignetteStatuses(alice.id);

    expect(status.latestResult).toBeNull();
    expect(status.lastAttemptFailed).toBe(true);
  });

  it("stops listing a soft-deleted car's checks", async () => {
    const { alice, aliceCar } = await fixtures();
    await recordVignetteCheck(alice.id, aliceCar.id, active("2026-12-15T23:59:59"));

    await softDeleteCar(alice.id, aliceCar.id);

    expect(await getCarVignetteStatuses(alice.id)).toEqual([]);
    // The rows survive — soft delete preserves history.
    expect(await prisma.vignetteCheck.count()).toBe(1);
  });

  it("keeps two users' cars separate when both have checks", async () => {
    const { alice, bob, aliceCar, bobCar } = await fixtures();
    await recordVignetteCheck(alice.id, aliceCar.id, active("2026-12-15T23:59:59"));
    await recordVignetteCheck(bob.id, bobCar.id, none);

    const [aliceStatus] = await getCarVignetteStatuses(alice.id);
    const [bobStatus] = await getCarVignetteStatuses(bob.id);

    expect(aliceStatus.carId).toBe(aliceCar.id);
    expect(aliceStatus.latestResult?.outcome).toBe("ACTIVE");
    expect(bobStatus.carId).toBe(bobCar.id);
    expect(bobStatus.latestResult?.outcome).toBe("NONE");
  });
});

describe("getLastVignetteAttempt", () => {
  it("returns the newest attempt for the caller's car", async () => {
    const { alice, aliceCar } = await fixtures();
    await checkAt(aliceCar.id, "2026-08-01T10:00:00.000Z", none);
    await checkAt(aliceCar.id, "2026-08-09T10:00:00.000Z", unavailable);

    const attempt = await getLastVignetteAttempt(alice.id, aliceCar.id);

    expect(attempt?.checkedAt.toISOString()).toBe("2026-08-09T10:00:00.000Z");
  });

  it("returns null for another user's car — so the cooldown cannot be probed", async () => {
    // Also the isolation that stops the action reaching the service at all: a
    // forged carId resolves to no attempt AND no car.
    const { alice, bob, bobCar } = await fixtures();
    await recordVignetteCheck(bob.id, bobCar.id, none);

    expect(await getLastVignetteAttempt(alice.id, bobCar.id)).toBeNull();
    expect(await getLastVignetteAttempt(bob.id, bobCar.id)).not.toBeNull();
  });
});
