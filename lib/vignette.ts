/**
 * Bulgarian vignette validity, from `check.bgtoll.bg`.
 *
 * ## ⚠️ The body is the signal, never the HTTP status
 *
 * Discovery observed **every** response as HTTP 200 — including "this plate has
 * no vignette", which arrives with an embedded `status.code: 500` while nothing
 * is wrong at all. Reading `response.ok` or the status code would classify a
 * perfectly normal answer as a server error.
 *
 * ## ⚠️ "none" and "unavailable" must never collapse into each other
 *
 * Telling someone they have no vignette because the service was unreachable
 * tells them their vignette expired when it did not — the most damaging thing
 * this module can get wrong. A missing vignette is `none`; anything we could not
 * read or understand is `unavailable`.
 *
 * ## The country is hardcoded BG
 *
 * `Car` has no country column, so a foreign-plated car returns `none` — which is
 * literally true: there is no *Bulgarian* vignette for it. The UI says
 * "Bulgarian vignette" so that reads as a fact rather than a bug. Adding a
 * country field, or a plate-format regex, would both cut against standing
 * decisions (the owner may register a car in any country).
 *
 * Unofficial and undocumented: this is an internal endpoint of a public web app.
 * It may change without notice, which is why the parse is defensive and every
 * failure lands in `unavailable` rather than throwing.
 */

import { createStubVignetteClient } from "@/lib/vignette-stub";

const BASE_URL = "https://check.bgtoll.bg/check/vignette/plate/BG";

export type VignetteResult =
  /** An active vignette exists. Dates are as the service reports them, without a timezone. */
  | {
      kind: "active";
      validFrom: string | null;
      validUntil: string | null;
      vignetteNumber: string | null;
      exempt: boolean;
    }
  /** No active Bulgarian vignette for this plate. A definite answer, not a failure. */
  | { kind: "none" }
  /** We could not get a trustworthy answer. NEVER shown as "no vignette". */
  | { kind: "unavailable"; reason: string };

export interface VignetteClient {
  check(licensePlate: string): Promise<VignetteResult>;
}

/**
 * Strips separators for the URL path.
 *
 * `lib/validation/car.ts` already trims and uppercases on input, so this only
 * removes spaces, dashes and dots. **Not a format check** — the standing
 * decision is no plate regex, because a guessed pattern would reject a valid
 * foreign plate.
 */
export function normalisePlate(licensePlate: string): string {
  return licensePlate.toUpperCase().replace(/[\s.\-_]/g, "");
}

/** Reads a string field, treating empty and non-strings as absent. */
function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function createVignetteClient(fetchImpl: typeof fetch = fetch): VignetteClient {
  return {
    async check(licensePlate) {
      const plate = normalisePlate(licensePlate);
      if (plate === "") return { kind: "unavailable", reason: "empty licence plate" };

      let response: Response;
      try {
        response = await fetchImpl(`${BASE_URL}/${encodeURIComponent(plate)}`, {
          headers: { accept: "application/json" },
        });
      } catch (error) {
        // Network failure, DNS, timeout. Emphatically not "no vignette".
        return { kind: "unavailable", reason: `request failed: ${String(error)}` };
      }

      // Read as text first: when this service or one like it decides to answer
      // with an HTML error page, `response.json()` throws and a caller that
      // catches it broadly would be tempted to call that "no vignette".
      const raw = await response.text().catch(() => "");

      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        return {
          kind: "unavailable",
          reason: `non-JSON response (HTTP ${response.status})`,
        };
      }

      if (typeof body !== "object" || body === null) {
        return { kind: "unavailable", reason: "response was not an object" };
      }

      const envelope = body as Record<string, unknown>;
      const vignette = envelope["vignette"];

      // The definite "nothing here" answer. `ok: false` with a null vignette is
      // exactly what a plate with no vignette returns — and what a malformed
      // plate returns too, which the service gives us no way to distinguish.
      if (envelope["ok"] === false || vignette === null || vignette === undefined) {
        return { kind: "none" };
      }

      if (typeof vignette !== "object") {
        return { kind: "unavailable", reason: "vignette field was not an object" };
      }

      const details = vignette as Record<string, unknown>;

      // `statusBoolean`, never the `status` string — that one is Bulgarian
      // display text ("Активна") and will be reworded without notice.
      const active = details["statusBoolean"];
      if (typeof active !== "boolean") {
        return { kind: "unavailable", reason: "statusBoolean missing or not a boolean" };
      }

      if (!active) return { kind: "none" };

      return {
        kind: "active",
        validFrom: text(details["validityDateFrom"]),
        validUntil: text(details["validityDateTo"]),
        vignetteNumber: text(details["vignetteNumber"]),
        // An exempt vehicle reports price 0 and is still perfectly valid.
        // Treating price as significance would mark it inactive.
        exempt: details["exempt"] === true,
      };
    },
  };
}

/**
 * The configured client.
 *
 * `VIGNETTE_DRIVER` selects it: `"live"` (the default) or `"stub"`.
 *
 * ⚠️ **The default is `live`, which is the opposite of `STORAGE_DRIVER`'s safe
 * default — on purpose.** A storage driver falling back to local loses photos if
 * misconfigured, so it defaults to the harmless option. A vignette client
 * defaulting to the stub would silently show **fabricated vignette data** in
 * production, which is worse than any error: the user would trust a date that
 * came from a fixture. So production gets the real service by default, and the
 * test suites force the stub in two places — the Playwright workers and the
 * server under test — exactly as 04-04 had to do for `STORAGE_DRIVER`.
 */
export function getVignetteClient(): VignetteClient {
  if (process.env["VIGNETTE_DRIVER"] === "stub") {
    return createStubVignetteClient();
  }
  return createVignetteClient();
}
