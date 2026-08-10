/**
 * Which car a car-agnostic "add expense" should use, and whether to ask.
 *
 * Pure and database-free, like `lib/aggregation.ts` and `lib/consumption.ts` —
 * it imports nothing and decides nothing about ownership. The caller has already
 * fetched the user's own cars through `listActiveCars`, so every id reaching
 * here is one the user may write to; this only picks a default.
 *
 * **The default is the most recently ADDED car**, which is simply the first one
 * `listActiveCars` returns — it orders `createdAt: "desc"`. "Most recently used"
 * would be marginally better, and would cost a new scoped query shape whose only
 * purpose is a pre-selected `<option>`. By this project's standing rule a new
 * query shape needs its own isolation test and its own mutation test, which is
 * a lot of ceremony to buy a default. Deferred deliberately.
 */

/** The minimum a car has to expose for this decision. Keeps the tests trivial. */
type CarLike = { id: string };

export type QuickAddTarget =
  /** The user has no cars — there is nothing to attach an expense to. */
  | { kind: "no-cars" }
  /** Exactly one car: use it and show no picker at all. */
  | { kind: "single"; carId: string }
  /** Several cars: ask, with this one preselected. */
  | { kind: "choose"; defaultCarId: string };

/**
 * Note the three cases are distinguished by `kind`, not by a nullable id. An
 * earlier shape returned `{ defaultCarId: "", needsPicker: false }` for the
 * empty case, and an empty string is exactly the kind of value a caller
 * accidentally passes into a query as though it were an id.
 */
export function resolveQuickAddTarget(cars: readonly CarLike[]): QuickAddTarget {
  if (cars.length === 0) return { kind: "no-cars" };
  if (cars.length === 1) return { kind: "single", carId: cars[0].id };
  return { kind: "choose", defaultCarId: cars[0].id };
}

/** How a car is labelled in the picker: the plate, with the nickname when there is one. */
export function carOptionLabel(car: { licensePlate: string; nickname?: string | null }): string {
  return car.nickname ? `${car.nickname} · ${car.licensePlate}` : car.licensePlate;
}
