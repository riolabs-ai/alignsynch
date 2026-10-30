/**
 * Whether this process has a `/demo` at all (#183, part 2 of 2).
 *
 * One switch is not enough for a backdoor, so there are two: `DEMO_AUTH=1` mounts the panel,
 * and it is **refused** when `VERCEL_ENV=production` unless `DEMO_ALLOW_PRODUCTION=1` is also
 * set. Two variables to enable a demo login in production is the whole point — nobody sets
 * both by accident, and a preview deployment (where `VERCEL_ENV` is `preview`) works with one.
 *
 * The refusal is implemented here, not documented and hoped for: `demoMode()` answers `refused`,
 * the page calls `notFound()`, and nothing renders, so a production deployment that inherited
 * `DEMO_AUTH=1` from a copied environment file answers the same 404 a URL that never existed
 * does.
 *
 * A third refusal, because a panel with no PIN is worse than no panel: `DEMO_AUTH=1` with
 * `DEMO_PIN` unset or empty is **not** demo mode. An empty expected PIN would otherwise be
 * compared against whatever was typed, which is exactly the "one click signs in as anyone"
 * shape this card exists to avoid.
 *
 * Pure: `demoModeFor()` takes the three values as an argument, so `tests/demo-mode.test.ts`
 * drives every branch without touching `process.env`, and `demoMode()` is the only function
 * that reads the environment.
 */

/** `DEMO_AUTH=1` mounts the panel. Exactly that spelling — see `scripts/db-seed.mjs`. */
export const DEMO_AUTH_ENV = "DEMO_AUTH";

/** The second switch: a production deployment needs this *and* `DEMO_AUTH=1`. */
export const DEMO_ALLOW_PRODUCTION_ENV = "DEMO_ALLOW_PRODUCTION";

/** The PIN every demo sign-in must carry. Server-side only — never a `NEXT_PUBLIC_` variable. */
export const DEMO_PIN_ENV = "DEMO_PIN";

/** Vercel sets this in every deployment it builds; locally it is absent. */
export const VERCEL_ENV_ENV = "VERCEL_ENV";

/** The one value any of these switches accepts. Not `true`, not `yes`, not `"1 "`. */
export const DEMO_FLAG_ON = "1";

/**
 * What the environment decided.
 *
 * `refused` carries a reason that is safe to log (it names variables, never values): the log
 * line is how an operator learns a production deployment ignored `DEMO_AUTH=1`, and a blog of
 * raw environment would be a credential leak waiting for a typo.
 */
export type DemoMode =
  | { readonly kind: "off"; readonly reason: "unset" | "other-value" }
  | { readonly kind: "refused"; readonly reason: "production" | "no-pin" }
  | { readonly kind: "demo"; readonly production: boolean };

/** The three values the decision reads, handed in so the decision is testable. */
export interface DemoEnv {
  readonly demoAuth: string | undefined;
  readonly vercelEnv: string | undefined;
  readonly allowProduction: string | undefined;
  readonly pin: string | undefined;
}

/**
 * The whole policy, as a value.
 *
 * Ordered deliberately: the flag first (an unset flag means the rest cannot matter), then the
 * production refusal, then the PIN, so the answer a deployment gets names the first thing that
 * stopped it.
 */
export function demoModeFor(env: DemoEnv): DemoMode {
  if (env.demoAuth !== DEMO_FLAG_ON) {
    return { kind: "off", reason: env.demoAuth === undefined ? "unset" : "other-value" };
  }

  const production = env.vercelEnv === "production";
  if (production && env.allowProduction !== DEMO_FLAG_ON) {
    return { kind: "refused", reason: "production" };
  }

  if (env.pin === undefined || env.pin.trim() === "") {
    return { kind: "refused", reason: "no-pin" };
  }

  return { kind: "demo", production };
}

/**
 * The mode of **this** process, read fresh on every call.
 *
 * No cache: three `process.env` reads cost nothing, and a cached answer would make the one
 * thing an operator does in an incident — set the variable and restart — depend on whether the
 * module happened to be imported by the previous request.
 */
export function demoMode(): DemoMode {
  return demoModeFor({
    demoAuth: process.env[DEMO_AUTH_ENV],
    vercelEnv: process.env[VERCEL_ENV_ENV],
    allowProduction: process.env[DEMO_ALLOW_PRODUCTION_ENV],
    pin: process.env[DEMO_PIN_ENV],
  });
}

/**
 * The one line `instrumentation.ts` logs at startup.
 *
 * It names the mode and the variables that produced it, and it never carries a value: not the
 * PIN, not a demo password (there is none here), not a session. A line saying `mode=demo` in a
 * log is the audit trail that this deployment mounted a backdoor on purpose.
 */
export function demoModeLogLine(mode: DemoMode): string {
  if (mode.kind === "demo") {
    const where = mode.production ? "production (DEMO_ALLOW_PRODUCTION=1)" : "non-production";
    return `[demo-auth] mode=demo — DEMO_AUTH=1 in ${where}: /demo is mounted, demo mode — not a real login`;
  }
  if (mode.kind === "refused" && mode.reason === "production") {
    return "[demo-auth] mode=refused — DEMO_AUTH=1 but VERCEL_ENV=production without DEMO_ALLOW_PRODUCTION=1: /demo stays a 404";
  }
  if (mode.kind === "refused" && mode.reason === "no-pin") {
    return "[demo-auth] mode=refused — DEMO_AUTH=1 but DEMO_PIN is empty: /demo stays a 404";
  }
  const why = mode.kind === "off" && mode.reason === "other-value" ? "not 1" : "unset";
  return `[demo-auth] mode=off — DEMO_AUTH is ${why}: /demo is not mounted`;
}
