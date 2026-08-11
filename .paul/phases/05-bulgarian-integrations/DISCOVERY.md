---
phase: 05-bulgarian-integrations
topic: "Callable mechanisms for the КАТ/МВР fines lookup and the vignette validity check"
depth: standard
confidence: MEDIUM-HIGH
created: 2026-08-11
---

# Discovery: Bulgarian Fines and Vignette Lookups

**Recommendation:** Both checks are buildable. Call them **server-side only**, parse the **body
rather than the HTTP status**, and treat the fines lookup as a **per-person** check that is
*attributed* to a car — not a per-car check. **The one thing needing a decision before planning is
where the ЕГН and driving licence number live**, because the fines lookup cannot be made without
them.

**Confidence:** **MEDIUM-HIGH.** Both endpoints were called live from this machine and behaved as
described. The shape of an *actual fine* comes from a third-party library's recorded fixtures rather
than from an observed response, because the account used for verification currently has no fines.

> ⚠️ **This document deliberately contains no real ЕГН, driving licence number or licence plate.**
> The examples that produced these findings were supplied privately and are replaced here with
> placeholders. This repository is public.

## Objective

The roadmap has blocked this phase since ideation on: *does any callable mechanism exist?* With two
candidate endpoints supplied, the questions became:

- Do the endpoints work, and what exactly do they return?
- How do they signal failure, absence and rate limiting?
- Do they need authentication, particular headers, or a browser?
- What identifiers must the app hold, and what does that mean for storing personal data?
- Are fines per person or per car?

## Scope

**Include:** live verification of both endpoints; success, empty, invalid-input and error shapes;
headers; throttling behaviour; the fine object's fields; the resulting design constraints.

**Exclude:** payment flows (the fines response carries IBAN/payment data — out of scope for this
project); any deployment or scheduling decision; legal advice.

## Findings

### A. Vignette check — `check.bgtoll.bg`

**Source:** `GET https://check.bgtoll.bg/check/vignette/plate/BG/{PLATE}` — verified live,
2026-08-11.

No authentication, no headers required, no cookies. Response in ~110–150 ms.

**Valid, active vignette** → `ok: true` and a populated `vignette` object:

| Field | Type | Note |
|---|---|---|
| `licensePlateNumber`, `country` | str | Echoed back |
| `status` | str | **Bulgarian text**, e.g. `"Активна"` |
| `statusBoolean` | bool | The machine-readable form — use this, not `status` |
| `validityDateFrom` / `To` | str | ISO-like, `2026-12-15T23:59:59`, **no timezone** |
| `validityDateFromFormated` / `ToFormated` | str | `15.12.2026 23:59:59` — display-only |
| `issueDate`, `issueDateFormated` | str | Same pair pattern |
| `price` | int | **`0` is legitimate** for exempt vehicles |
| `currency` | str | `EUR` observed |
| `exempt`, `whitelist` | bool | Exempt vehicles exist and return `price: 0` |
| `vignetteNumber` | str | |
| `vehicleClass`, `emissionsClass`, `vehicleType` (+`…Code`) | null | Null on the sample seen |

**No vignette** → `{"vignette": null, "ok": false, "status": {"code": 500, "message":
"public.ui.ok.noVignette"}}`

**⚠️ Every response is HTTP 200**, including that one, and the embedded `status.code` reads `500`
while nothing is actually wrong. **A malformed plate returns exactly the same body as a valid plate
with no vignette** — the two are indistinguishable, so the app must validate plate format itself if
it wants to tell a user they mistyped.

Five sequential requests: all 200, no throttling observed, no rate-limit headers.

### B. Fines check — `e-uslugi.mvr.bg`

**Source:** `GET https://e-uslugi.mvr.bg/api/Obligations/AND?obligatedPersonType=1&additinalDataForObligatedPersonType=1&mode=1&obligedPersonIdent={ЕГН}&drivingLicenceNumber={LICENCE}`
— verified live, 2026-08-11. (`additinalDataForObligatedPersonType` is misspelled at the source;
it must be sent that way.)

No authentication or cookies. `accept-language` is optional — `bg` and `en` both returned the same
structure. Response in ~60–660 ms.

**Envelope**, always the same shape:

```json
{"obligationsData":[
  {"unitGroup":1,"errorNoDataFound":false,"errorReadingData":false,"obligations":[]},
  {"unitGroup":2,"errorNoDataFound":false,"errorReadingData":false,"obligations":[]}]}
```

Two `unitGroup`s are always returned (1 and 2 — two issuing systems), each with its own error flags
and its own array. **Results must be merged across both groups.**

**A fine object** (from `py_kat_bulgaria`'s recorded fixtures — *not* observed live):

| Field | Example | Note |
|---|---|---|
| `amount` | `50` | int. ⚠️ No currency field — see open questions |
| `discountAmount` | `50` | Relationship to `amount` unclear |
| `status`, `type`, `serviceID`, `andSourceId` | ints | Undocumented enums |
| `obligationIdentifier` | `KAT\|TICKET\|18646***` | Pipe-delimited; a plausible idempotency key |
| `obligationDate`, `expirationDate` | `2024-08-26T00:00:00` | Naive datetimes again |
| `paymentReason` | `ФИШ СЕРИЯ GT 1234*** 29.07.2024` | Human text |
| `iban`, `bic`, `bankName`, `pepCin` | | Payment details — out of scope |
| `additionalData.vehicleNumber` | `PВ0000AA` | **The licence plate the fine was issued against** |
| `additionalData.breachOfOrder` | `чл. 147, ал. 1, от ЗДвП` | The legal article breached |
| `additionalData.breachDate`, `issueDate` | `2024-07-29` | Date only |
| `additionalData.documentType/Series/Number` | `TICKET` / `GT` / … | |
| `additionalData.isServed` | `"True"` | ⚠️ **A string, not a boolean** |
| `additionalData.amount`, `discount` | `"50"`, `"0"` | ⚠️ **Strings**, duplicating the ints above |
| `additionalData.obligedPersonIdent` | `880101****` | The ЕГН comes back in the response |

**Error signalling** is per unit group, and coarse:

| Condition | Signal |
|---|---|
| No fines | Both groups `errorNoDataFound:false`, `errorReadingData:false`, empty arrays |
| Person not found | `errorNoDataFound: true` |
| Upstream failure | `errorReadingData: true` |
| **Invalid identifiers** | `errorReadingData: true` — **identical to an upstream failure** |
| Missing a required parameter | `{"obligationsData":[]}` — empty envelope |
| **Rate limited** | ⚠️ **A ~429 KB HTML page**, not JSON |

The rate-limit page reads *"Достигнат е максимално допустимият брой заявки към системата"* (the
maximum number of requests to the system has been reached). A response header
`x-contextlimiter-token` is present on every response, confirming a throttling layer. **The
threshold is unknown**; five sequential requests were not enough to trigger it, and I did not push
further against a public government service.

## Comparison

| Criterion | Vignette (bgtoll) | Fines (МВР) |
|---|---|---|
| Auth required | No | No |
| Keyed by | Licence plate | **ЕГН + driving licence** |
| Personal data needed | Plate only | **National identity number** |
| Failure signalled by | Body (`ok`) | Body (per-group flags) |
| Non-JSON responses | Not observed | **Yes — HTML when throttled** |
| Distinguishes bad input | **No** | No (looks like an outage) |
| Throttling | None observed | **Confirmed present, threshold unknown** |
| Official documentation | None | None |
| Stability risk | Medium | Medium-High |

## Recommendation

**Build both, with these constraints — each of which follows from something observed above.**

1. **Server-side only.** Neither endpoint returned CORS headers, so a browser cannot call them
   cross-origin. This matches the existing plan for `/api/fines/check` and `/api/vignette/check`.
2. **Never trust the HTTP status.** Both services answer 200 for logical failures, and МВР answers
   with HTML when throttled. Check the content type before parsing, then parse the body.
   *This is the same trap as the Supabase adapter in 04-04, and it is worth noting that the project
   has now met it twice in consecutive phases.*
3. **Fines are per person; the vignette is per car.** The roadmap describes both as per-car, and
   that is wrong for fines: the request takes a person's identifiers and returns fines across all
   their vehicles, each carrying `additionalData.vehicleNumber`. The natural model is to check once
   per user and *attribute* each fine to a Car by matching that plate — with fines for unknown
   plates still shown rather than dropped.
4. **Rate-limit our own routes and cache results.** Already a project convention; the МВР limiter
   makes it mandatory rather than polite. Store the last check's result and timestamp so the UI can
   show "checked 2 hours ago" instead of re-querying on every page view.
5. **Treat a parse failure as "unavailable", never as "no fines".** Reporting zero fines because a
   government portal returned an HTML error page is the worst available failure mode.

### ⚠️ The decision that must be made before planning: where the ЕГН lives

The fines lookup **cannot be performed without a national identity number and a driving licence
number**. That is materially more sensitive than anything this project currently stores, and it is
the one question discovery cannot answer on its own.

| Option | For | Against |
|---|---|---|
| **A. Never store — enter at check time** | No PII at rest. Nothing to leak, encrypt, or migrate. Simplest to reason about | Retyping an ЕГН every check is real friction, and friction is what this app exists to remove |
| **B. Store encrypted, opt-in per user** | One-tap checks; scheduled checks become possible | Introduces key management, a real breach consequence, and a migration. The encryption key would live beside the data on the same host |
| **C. Store in plaintext** | Trivial | A national identity number in a database with no compensating control. Not defensible even for a personal app |

**Recommendation: (A) for the first plan**, with (B) as a deliberate, separately-approved follow-up
if the friction proves real in use. Rationale: the project has no deployment yet, the vignette check
— the more frequently useful of the two — needs no personal data at all, and the cost of choosing
(A) now and (B) later is one migration, while the cost of the reverse is a leak.

## Open Questions

- **Currency of the fine `amount`.** Bulgaria adopted the euro on 2026-01-01, and the vignette
  endpoint returns `currency: "EUR"`. The fine fixtures are from 2024 and carry no currency field at
  all. The project is EUR-only and stores integer cents, so this must be settled against a real
  fine before any amount is displayed or stored. — Impact: **high**
- **The rate-limit threshold**, and whether it is per IP. On a serverless deploy the app's egress IP
  is shared, so the limit may be reached by someone else entirely. — Impact: **high**
- **Whether the МВР endpoint is reachable from Vercel's egress IPs.** Government services sometimes
  geo-block or block cloud ranges. Untestable from here. — Impact: **high**, and it would invalidate
  the whole approach if it fails
- **`status`, `type`, `serviceID`, `andSourceId` enum meanings**, and how `discountAmount` relates to
  `amount`. — Impact: medium
- **What `unitGroup` 1 and 2 actually are.** Results must be merged, but labelling them for the user
  needs an answer. — Impact: low
- **Terms of service.** Neither endpoint is a published API; both are internal to public web
  portals. Nothing observed suggests prohibition, but nothing was reviewed either. Automated polling
  at any volume deserves thought. — Impact: medium

## Quality Report

**Sources:**

- `https://check.bgtoll.bg/check/vignette/plate/BG/{PLATE}` — called live, 2026-08-11
- `https://e-uslugi.mvr.bg/api/Obligations/AND?…` — called live, 2026-08-11
- [Nedevski/py_kat_bulgaria](https://github.com/Nedevski/py_kat_bulgaria) — MIT, last pushed
  2026-05-10. Recorded response fixtures, the only source found for the fine object's shape.
  **Reference only — not a dependency; this project is TypeScript**
- [e-uslugi.mvr.bg/services/obligations](https://e-uslugi.mvr.bg/services/obligations) — the public
  portal the endpoint backs. No API documentation published

**Verified by direct observation:** both endpoints respond without authentication; the vignette
success/absent/malformed shapes; the fines envelope and its two unit groups; that invalid
identifiers surface as `errorReadingData: true`; that a missing parameter returns an empty envelope;
that `accept-language` does not change the structure; that neither service returns CORS headers;
that five sequential requests to each are not throttled.

**Taken from third-party fixtures, not observed:** every field of an actual fine object, and the
HTML rate-limit response. The library's fixtures are consistent with the envelope observed live,
which raises confidence but does not equal a live observation.

**Assumed, not verified:** that the fine shape is unchanged since those 2024 fixtures — the euro
changeover in particular makes this doubtful for `amount`.

---
*Discovery completed: 2026-08-11*
*Confidence: MEDIUM-HIGH*
*Ready for: /paul:plan 05 — after the ЕГН storage decision is made*
