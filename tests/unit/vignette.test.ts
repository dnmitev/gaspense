import { describe, expect, it, vi } from "vitest";
import { createVignetteClient, normalisePlate } from "@/lib/vignette";

/**
 * The vignette client, against an injected `fetch`.
 *
 * ⚠️ **Every body below was observed live during discovery** (2026-08-11) and is
 * reproduced verbatim, not invented. That matters because 04-04 proved a stub
 * built from documentation can be confidently wrong: its Supabase adapter passed
 * against an assumed 404 while the real service answered 400. If this client
 * changes, re-run `npm run verify:vignette` rather than trusting these fixtures.
 */

/** The real shape of an active vignette, with the plate replaced. */
const ACTIVE_BODY = JSON.stringify({
  vignette: {
    licensePlateNumber: "XX0000XX",
    country: "BG",
    exempt: false,
    vignetteNumber: "BGV0000000000001",
    vehicleClass: null,
    emissionsClass: null,
    validityDateFromFormated: "16.01.2026 00:00:00",
    validityDateFrom: "2026-01-16T00:00:00",
    validityDateToFormated: "15.12.2026 23:59:59",
    validityDateTo: "2026-12-15T23:59:59",
    issueDateFormated: "16.01.2026 10:00:00",
    issueDate: "2026-01-16T10:00:00",
    price: 5200,
    currency: "EUR",
    status: "Активна",
    whitelist: false,
    statusBoolean: true,
  },
  ok: true,
  status: { code: 200, message: "public.ui.ok" },
});

/** The real "no vignette" answer — note the embedded 500 while nothing is wrong. */
const NO_VIGNETTE_BODY = JSON.stringify({
  vignette: null,
  ok: false,
  status: { code: 500, message: "public.ui.ok.noVignette" },
});

function stub(response: Response) {
  return vi.fn(async () => response) as unknown as typeof fetch;
}

const ok = (body: string) =>
  new Response(body, { status: 200, headers: { "content-type": "application/json" } });

describe("normalisePlate", () => {
  it("strips separators and uppercases", () => {
    expect(normalisePlate(" cb 27-19.oa ")).toBe("CB2719OA");
  });

  it("leaves an already-clean plate alone", () => {
    expect(normalisePlate("XX0000XX")).toBe("XX0000XX");
  });

  it("does not reject an unfamiliar shape", () => {
    // No plate regex, by standing decision — the owner may register a car in any
    // country and a guessed pattern would refuse a valid foreign plate.
    expect(normalisePlate("W-123ABC")).toBe("W123ABC");
  });
});

describe("createVignetteClient", () => {
  it("reports an active vignette with its validity dates", async () => {
    const client = createVignetteClient(stub(ok(ACTIVE_BODY)));

    const result = await client.check("XX0000XX");

    expect(result).toEqual({
      kind: "active",
      validFrom: "2026-01-16T00:00:00",
      validUntil: "2026-12-15T23:59:59",
      vignetteNumber: "BGV0000000000001",
      exempt: false,
    });
  });

  it("reports 'none' for the no-vignette answer, NOT an error", async () => {
    // ⚠️ The central trap: HTTP 200, `ok: false`, and an embedded status.code of
    // 500 while nothing is wrong at all. Reading the status would call this an
    // outage; reading the body calls it what it is.
    const client = createVignetteClient(stub(ok(NO_VIGNETTE_BODY)));

    expect(await client.check("XX0000XX")).toEqual({ kind: "none" });
  });

  it("reports 'none' when statusBoolean is false", async () => {
    const expired = JSON.stringify({
      vignette: { statusBoolean: false, status: "Изтекла" },
      ok: true,
    });

    expect(await createVignetteClient(stub(ok(expired))).check("XX0000XX")).toEqual({
      kind: "none",
    });
  });

  it("treats an exempt vignette as active, with its real quirks", async () => {
    // ⚠️ This fixture was CORRECTED from a live observation during 05-01's AC-6
    // verification. An exempt vehicle really returns `vignetteNumber: null` and a
    // sentinel `validityDateFrom` of 1980-01-01 — the first version of this test
    // invented a plausible vignette number and a plausible start date, which is
    // exactly the kind of fiction that let 04-04's adapter pass while being wrong.
    //
    // Treating price 0 as insignificance would mark this inactive; it is valid.
    const exempt = JSON.stringify({
      vignette: {
        statusBoolean: true,
        exempt: true,
        whitelist: true,
        price: 0,
        currency: "EUR",
        validityDateFrom: "1980-01-01T02:00:00",
        validityDateTo: "2026-12-15T23:59:59",
        vignetteNumber: null,
      },
      ok: true,
    });

    const result = await createVignetteClient(stub(ok(exempt))).check("XX0000XX");

    expect(result).toEqual({
      kind: "active",
      validFrom: "1980-01-01T02:00:00",
      validUntil: "2026-12-15T23:59:59",
      vignetteNumber: null,
      exempt: true,
    });
  });

  it("reports 'unavailable' for a non-JSON body, never 'none'", async () => {
    // The МВР service in the same family answers with a 429 KB HTML page when
    // throttled. If this one ever does the same, it must not read as "no
    // vignette" — that would tell someone their vignette expired.
    const html = new Response("<!doctype html><html><body>Too many requests</body></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });

    const result = await createVignetteClient(stub(html)).check("XX0000XX");

    expect(result.kind).toBe("unavailable");
  });

  it("reports 'unavailable' when the request throws", async () => {
    const failing = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    const result = await createVignetteClient(failing).check("XX0000XX");

    expect(result).toMatchObject({ kind: "unavailable" });
    expect(result.kind === "unavailable" && result.reason).toContain("ECONNREFUSED");
  });

  it("reports 'unavailable' for JSON that parses but lacks the fields", async () => {
    // An unofficial endpoint may change shape without notice. An unrecognised
    // shape is "we do not know", not "no vignette".
    const odd = JSON.stringify({ vignette: { somethingElse: true }, ok: true });

    expect((await createVignetteClient(stub(ok(odd))).check("XX0000XX")).kind).toBe("unavailable");
  });

  it("reports 'unavailable' for a JSON scalar body", async () => {
    expect((await createVignetteClient(stub(ok("42"))).check("XX0000XX")).kind).toBe("unavailable");
  });

  it("refuses an empty plate without making a request", async () => {
    const fetchImpl = stub(ok(ACTIVE_BODY));

    const result = await createVignetteClient(fetchImpl).check("   ");

    expect(result.kind).toBe("unavailable");
    expect(fetchImpl as unknown as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it("builds the URL with the BG country segment and a normalised plate", async () => {
    const fetchImpl = stub(ok(ACTIVE_BODY));

    await createVignetteClient(fetchImpl).check(" cb 27-19 oa ");

    const mock = fetchImpl as unknown as ReturnType<typeof vi.fn>;
    expect(mock.mock.calls[0][0]).toBe("https://check.bgtoll.bg/check/vignette/plate/BG/CB2719OA");
  });
});
