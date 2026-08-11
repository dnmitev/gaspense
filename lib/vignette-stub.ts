import type { VignetteClient, VignetteResult } from "@/lib/vignette";

/**
 * A fake vignette service for the test suites.
 *
 * ⚠️ **The suites must never call `check.bgtoll.bg`.** It is a public government
 * endpoint, it is throttled elsewhere in the same family of services, and a CI
 * run that depends on it is both rude and flaky. `tests/integration/setup.ts`
 * and `playwright.config.ts` force `VIGNETTE_DRIVER=stub`.
 *
 * The results below mirror the shapes recorded in DISCOVERY.md, so a test
 * written against this stub is written against something the real service
 * actually returns. That is the *most* a stub can offer — it still cannot tell
 * you the real API changed, which is why `npm run verify:vignette` exists.
 */

/** Plates the stub recognises. Anything else behaves as a plate with no vignette. */
export const STUB_PLATES = {
  /** Has an active vignette, expiring at a fixed date. */
  active: "STUB0001",
  /** Explicitly has no vignette — the `ok: false` answer. */
  none: "STUB0002",
  /** The service could not be read. Must never render as "no vignette". */
  unavailable: "STUB0003",
} as const;

export function createStubVignetteClient(): VignetteClient {
  return {
    async check(licensePlate): Promise<VignetteResult> {
      const plate = licensePlate.toUpperCase().replace(/[\s.\-_]/g, "");

      if (plate === STUB_PLATES.unavailable) {
        return { kind: "unavailable", reason: "stub: service unavailable" };
      }

      if (plate === STUB_PLATES.active) {
        return {
          kind: "active",
          // Same format as the real service: naive, no timezone.
          validFrom: "2026-01-16T00:00:00",
          validUntil: "2026-12-15T23:59:59",
          vignetteNumber: "STUBVIGNETTE0001",
          exempt: false,
        };
      }

      return { kind: "none" };
    },
  };
}
