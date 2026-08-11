import type { VignetteOutcome } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { VignetteResult } from "@/lib/vignette";

/**
 * Scoped data access for vignette checks, and the cooldown that limits them.
 *
 * `VignetteCheck` carries no `userId` — ownership resolves through
 * `car → userId`, the same shape as `Expense`. Every function takes `userId`
 * explicitly and puts it in the same query as the id.
 */

/** A live car the caller owns. Soft-deleted cars stop being checkable, as they stop being reportable. */
const ownedCar = (userId: string) => ({ userId, deletedAt: null });

/**
 * How long before the same car may be checked again.
 *
 * ⚠️ **This cooldown IS the rate limit.** The project convention says to
 * rate-limit the external check paths; rather than a counter table or an
 * in-memory map that separate serverless invocations cannot share, the refusal is
 * derived from `checkedAt` on a row we already store. It is per car — the thing
 * actually worth limiting — and it survives a cold start because it lives in
 * Postgres.
 *
 * Six hours because a vignette's validity changes at most once a day. Long enough
 * that nobody can hammer the service by holding down a button; short enough that
 * buying one and seeing it appear is not an annoying wait.
 */
export const VIGNETTE_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/**
 * Milliseconds still to wait, or 0 when a check is allowed.
 *
 * Takes `now` rather than reading the clock, so it is a pure function and the
 * tests do not have to freeze time.
 */
export function vignetteCooldownRemaining(
  lastCheckedAt: Date | null | undefined,
  now: Date,
): number {
  if (!lastCheckedAt) return 0;

  const elapsed = now.getTime() - lastCheckedAt.getTime();
  // A negative elapsed time means a clock skew or a future-dated row. Treat it as
  // "wait the full window" rather than "allowed" — the safe direction against a
  // service we are trying not to hammer.
  if (elapsed < 0) return VIGNETTE_COOLDOWN_MS;

  return elapsed >= VIGNETTE_COOLDOWN_MS ? 0 : VIGNETTE_COOLDOWN_MS - elapsed;
}

/** Naive datetimes from the service; null when absent or unparseable. */
function toDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const OUTCOME: Record<VignetteResult["kind"], VignetteOutcome> = {
  active: "ACTIVE",
  none: "NONE",
  unavailable: "UNAVAILABLE",
};

export type CarVignetteStatus = {
  carId: string;
  /** The latest check that actually reached the service. Null when there has never been one. */
  latestResult: {
    outcome: Extract<VignetteOutcome, "ACTIVE" | "NONE">;
    checkedAt: Date;
    validUntil: Date | null;
    exempt: boolean;
  } | null;
  /** The latest row of ANY kind, including failures — "when did we last try". */
  lastAttemptAt: Date | null;
  /** True when the most recent attempt failed, whatever the last result was. */
  lastAttemptFailed: boolean;
};

/**
 * The vignette status of every car the caller owns.
 *
 * ⚠️ **Two different "latest" values, deliberately.** `latestResult` is the most
 * recent check that got an answer; `lastAttemptAt` is the most recent attempt of
 * any kind. Collapsing them would either hide that the service is failing, or —
 * far worse — let an `UNAVAILABLE` row overwrite a known-good `ACTIVE` status and
 * report an outage as an expired vignette.
 */
export async function getCarVignetteStatuses(userId: string): Promise<CarVignetteStatus[]> {
  const rows = await prisma.vignetteCheck.findMany({
    where: { car: ownedCar(userId) },
    orderBy: { checkedAt: "desc" },
    select: {
      carId: true,
      checkedAt: true,
      outcome: true,
      validUntil: true,
      exempt: true,
    },
  });

  const byCar = new Map<string, CarVignetteStatus>();

  // Rows arrive newest first, so the first row seen per car is the latest attempt
  // and the first non-UNAVAILABLE row per car is the latest result.
  for (const row of rows) {
    const existing = byCar.get(row.carId);

    if (!existing) {
      byCar.set(row.carId, {
        carId: row.carId,
        latestResult:
          row.outcome === "UNAVAILABLE"
            ? null
            : {
                outcome: row.outcome,
                checkedAt: row.checkedAt,
                validUntil: row.validUntil,
                exempt: row.exempt ?? false,
              },
        lastAttemptAt: row.checkedAt,
        lastAttemptFailed: row.outcome === "UNAVAILABLE",
      });
      continue;
    }

    if (!existing.latestResult && row.outcome !== "UNAVAILABLE") {
      existing.latestResult = {
        outcome: row.outcome,
        checkedAt: row.checkedAt,
        validUntil: row.validUntil,
        exempt: row.exempt ?? false,
      };
    }
  }

  return [...byCar.values()];
}

/** The most recent attempt for one car, or null. Used for the cooldown. */
export async function getLastVignetteAttempt(userId: string, carId: string) {
  return prisma.vignetteCheck.findFirst({
    where: { carId, car: ownedCar(userId) },
    orderBy: { checkedAt: "desc" },
  });
}

export type RecordResult = { ok: true; id: string } | { ok: false; reason: "not-found" };

/**
 * Stores a check result against a car the caller owns.
 *
 * An insert has no WHERE clause to carry scoping, so ownership is an explicit
 * pre-check — the same shape as `createExpense` and `createAttachmentForCar`.
 */
export async function recordVignetteCheck(
  userId: string,
  carId: string,
  result: VignetteResult,
): Promise<RecordResult> {
  const car = await prisma.car.findFirst({
    where: { id: carId, ...ownedCar(userId) },
    select: { id: true },
  });
  if (!car) return { ok: false, reason: "not-found" };

  const created = await prisma.vignetteCheck.create({
    data: {
      carId: car.id,
      outcome: OUTCOME[result.kind],
      validFrom: result.kind === "active" ? toDate(result.validFrom) : null,
      validUntil: result.kind === "active" ? toDate(result.validUntil) : null,
      vignetteNumber: result.kind === "active" ? result.vignetteNumber : null,
      exempt: result.kind === "active" ? result.exempt : null,
      failureReason: result.kind === "unavailable" ? result.reason : null,
    },
    select: { id: true },
  });

  return { ok: true, id: created.id };
}
