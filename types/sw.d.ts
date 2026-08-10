/**
 * Types for public/sw.js, the project's one plain-JavaScript source file.
 *
 * It lives here rather than as public/sw.d.ts because everything in public/ is
 * served to browsers, and a type declaration is not something anyone should be
 * able to fetch from the app.
 *
 * The parameter shapes are structural on purpose: the worker passes a real
 * `Request`, and tests/unit/sw-policy.test.ts passes an object literal. Both
 * satisfy these, which is the point — the rule is a pure function of method,
 * url and mode, and needs no browser to exercise.
 */
declare module "@/public/sw.js" {
  export function isNavigation(request: { mode?: string }): boolean;

  export function shouldCache(
    request: { method: string; url: string; mode?: string },
    origin: string,
  ): boolean;
}
