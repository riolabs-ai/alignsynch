/**
 * `isEnabled(name)` — the resolver. Server components and route handlers call it; **it is not a
 * client hook**, and a flag that only hides a button is not enforcement (issue #175).
 *
 * The store is the file next door (`data/flags.ts`); this module is the three steps that turn it
 * into a boolean, in this order:
 *
 *   1. `FLAG_<NAME>=1|0` — an environment override, read **per call**, so a flip needs a restart,
 *      never a rebuild of application code;
 *   2. `templates` — the per-template on declared on the flag;
 *   3. `default` — what every other template gets.
 *
 * Why the server only: the flag has to be able to make a route answer 404 and stop a data read
 * before it starts. A value the browser decided can do neither — it can unhide a nav entry and
 * let the request through, which is the failure mode the issue exists to prevent. So the module
 * refuses to run in a browser at all (see `isEnabled`), which is the enforcement, not a comment.
 *
 * A FLAGGED-OFF SURFACE IS OFF IN THREE PLACES, and a surface is only wired when all three are:
 *
 *   1. **the nav entry is absent** — `hiddenNavHrefs()` below is the shell's half; the sidebar
 *      renders a `NavItem` with `hidden` and it draws nothing;
 *   2. **the route answers 404, not 403** — the route calls `notFound()` before it renders, so
 *      an unshipped surface does not leak that it exists. `403` would say "this is here, you may
 *      not see it";
 *   3. **the data query does not run** — the read happens *after* the gate in the same module, so
 *      a flagged-off surface costs no fixture projection and no row read.
 *
 * `navSurfaces` below is the list of surfaces whose route is gated, and it is deliberately not
 * every flag: a flag whose route still renders is a flag that only hides an entry — the exact
 * thing the issue calls out. A surface joins this list (and gets its guard) in the same change or
 * it is declarative only, which is what the other seven are today.
 */
import { type FlagDefinition, type FlagName, flagDefinition } from "@/data/flags";

/** Some callers pass a name that only exists at runtime (a test, a config string). */
type Name = FlagName | (string & {});

/** The templates `BRAND` can name. Same values `data/brand.ts` switches on. */
const DEFAULT_TEMPLATE = "quizhub";

/**
 * The template this build renders. `BRAND` is declared in `next.config.mjs`'s `env`, so Next
 * inlines it: this is a build-time value by design — the template is chosen by the build, the
 * *flag* is what changes without one.
 */
export function currentTemplate(): string {
  return process.env.BRAND?.trim() || DEFAULT_TEMPLATE;
}

/**
 * `community.leaderboard` -> `FLAG_COMMUNITY_LEADERBOARD`. One spelling, derived, so an operator
 * never guesses an env name and two surfaces cannot collide on one variable.
 */
export function envNameFor(name: string): string {
  return `FLAG_${name.replace(/\./g, "_").toUpperCase()}`;
}

/**
 * `1` and `0` are the interface — anything else is a typo, and a typo is **ignored**, not
 * obeyed and not fatal. Not obeyed, because falling through to the next step never enables a
 * surface the operator did not ask for. Not fatal, because this module is resolved for the shell
 * of every page: throwing on `FLAG_X=yes` would take the whole app down over one word. The
 * warning names the variable and is printed once per process, so it is still loud in a log.
 */
export function parseOverride(raw: string | undefined): boolean | undefined {
  const value = raw?.trim();
  if (value === "1") return true;
  if (value === "0") return false;
  return undefined;
}

const warned = new Set<string>();

function warnUnreadableOverride(variable: string, raw: string): void {
  if (warned.has(variable)) return;
  warned.add(variable);
  console.warn(
    `feature flag: ${variable}="${raw.trim()}" is neither "1" nor "0" — ignored, falling back to the template value then the default`,
  );
}

export interface FlagContext {
  /** The template the build renders — `currentTemplate()` outside tests. */
  readonly template: string;
  /** The environment override, already parsed by `parseOverride`. */
  readonly override?: boolean;
}

/**
 * The precedence, as one pure function over a definition and a context. `isEnabled` is this plus
 * the environment; splitting it out is what lets `tests/flags.test.ts` prove all three steps
 * without writing to `process.env` for two of them.
 */
export function resolveFlag(definition: FlagDefinition, context: FlagContext): boolean {
  if (context.override !== undefined) return context.override;
  if (definition.templates?.includes(context.template)) return true;
  return definition.default;
}

/**
 * Is this surface on? Server components, route handlers and `generateMetadata` only.
 *
 * The browser check is the point: a client component that calls this would compile, but the flag
 * would be decided after the request was already served — so the call throws instead of quietly
 * becoming the "hide the button" flag the issue forbids.
 */
export function isEnabled(name: Name): boolean {
  if (typeof window !== "undefined") {
    throw new Error(
      `feature flag "${String(name)}" was resolved in a browser — lib/flags.ts is server-only. ` +
        "Gate the route (notFound()) and the data read on the server, and pass the boolean down as a prop.",
    );
  }
  const definition = flagDefinition(name as FlagName);
  const variable = envNameFor(String(name));
  const raw = process.env[variable];
  const override = parseOverride(raw);
  if (override === undefined && raw !== undefined && raw.trim() !== "") {
    warnUnreadableOverride(variable, raw);
  }
  return resolveFlag(definition, { template: currentTemplate(), override });
}

/**
 * The surfaces that own a nav entry *and* are gated. Href -> flag.
 *
 * Only a surface whose route is gated belongs here, because the nav and the route have to agree:
 * hiding an entry for a page that still renders is the "hiding a button" flag again, and linking
 * to a page that answers 404 is the dead link E10 exists to catch.
 *
 * The hrefs are literals on purpose — E10 scans them in the sidebar, and a map like this one is
 * exactly where a nav entry should be readable.
 */
export const navSurfaces: Readonly<Record<string, FlagName>> = {
  "/leaderboard": "community.leaderboard",
};

/** The hrefs the shell must not draw. Empty when every gated surface is on. */
export function hiddenNavHrefs(): readonly string[] {
  return Object.entries(navSurfaces)
    .filter(([, name]) => !isEnabled(name))
    .map(([href]) => href);
}
