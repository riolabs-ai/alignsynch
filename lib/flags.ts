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
 *
 * ## The role bypass (#184), and why the nav does not follow it
 *
 * A flag that declares `adminBypass: true` (one, `community.leaderboard`) resolves on for an
 * `admin` caller even while it is off for everyone else — so a surface the nav hides stays
 * reachable by the person who has to review it. The role is an argument, never an ambient read:
 * `isEnabled(name, { role })`, with the role resolved from the request's session by
 * `lib/auth/flag-gate.ts::enabledForCaller`. Nothing in this module touches a header or a cookie,
 * so there is no forged-role path through it.
 *
 * `hiddenNavHrefs()` deliberately takes **no** role. The sidebar is rendered into a prerendered
 * shell at build time, so a per-caller nav would either be a request-time shell (a much bigger
 * change than a flag) or a lie. The bypass makes the surface *reachable*, not *advertised* —
 * which is the correct reading of "hidden": the URL answers, the catalogue does not list it.
 */
import { flagDefinition, type FlagDefinition, type FlagName } from "@/data/flags";
import { type UserRole, roleAdmits } from "@/content/identity";

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
 *
 * `-` becomes `_` as well as `.` (#300). A hyphen is legal in a flag name and not exportable in a
 * shell, so a flag called `product.quiz-surfaces` would otherwise answer to `FLAG_PRODUCT_QUIZ-SURFACES`
 * — a variable `export` cannot set, which would quietly turn the operator's escape hatch into
 * documentation. The mapping stays one-to-one: two flag names that differ only in `.` versus `-`
 * would collide, so do not spell two flags that way.
 */
export function envNameFor(name: string): string {
  return `FLAG_${name.replace(/[.-]/g, "_").toUpperCase()}`;
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
  /**
   * The caller's role, resolved server-side from the request's session (#184) — or `null` when
   * nobody is signed in. **Only consulted by a flag that declares `adminBypass: true`**, and
   * this resolver never reads it from anywhere else: no header, no cookie, no prop.
   */
  readonly role?: UserRole | null;
}

/**
 * The precedence, as one pure function over a definition and a context. `isEnabled` is this plus
 * the environment; splitting it out is what lets `tests/flags.test.ts` prove all three steps
 * without writing to `process.env` for two of them.
 *
 * The role bypass is the one step ahead of the env: a flag that opts in with `adminBypass: true`
 * is on for an `admin` whatever the operator set, because locking an admin out of the surface
 * they are reviewing is the bug this exists to fix. A flag without the field never looks at
 * `context.role`, so its three steps are exactly the ones they were before #184.
 */
export function resolveFlag(definition: FlagDefinition, context: FlagContext): boolean {
  if (bypassesForAdmin(definition, context.role ?? null)) return true;
  if (context.override !== undefined) return context.override;
  if (definition.templates?.includes(context.template)) return true;
  return definition.default;
}

/**
 * Did this flag opt in, and is the caller the role it opted in for? Both halves, named once, so
 * the resolver and any caller that wants to know *whether* the session is worth reading agree on
 * one definition of the bypass.
 */
export function bypassesForAdmin(
  definition: Pick<FlagDefinition, "adminBypass">,
  role: UserRole | null,
): boolean {
  return definition.adminBypass === true && roleAdmits("admin", role);
}

/**
 * Does this flag opt in to the admin bypass at all? A flag that does not is decided without a
 * session, so a caller can skip the auth round trip and the profile read entirely — which is
 * what keeps `/leaderboard` free of Postgres in a deployment with no auth configured.
 */
export function declaresAdminBypass(name: Name): boolean {
  return flagDefinition(name as FlagName).adminBypass === true;
}

/**
 * Is this surface on? Server components, route handlers and `generateMetadata` only.
 *
 * `options.role` is the caller's role, resolved server-side from the request's session — the one
 * input a browser cannot supply (#184). Omit it and every flag answers as it did before: a flag
 * that opts in with `adminBypass: true` is on only when a caller passes `admin`.
 *
 * The browser check is the point: a client component that calls this would compile, but the flag
 * would be decided after the request was already served — so the call throws instead of quietly
 * becoming the "hide the button" flag the issue forbids.
 */
export function isEnabled(name: Name, options: { readonly role?: UserRole | null } = {}): boolean {
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
  return resolveFlag(definition, {
    template: currentTemplate(),
    override,
    role: options.role ?? null,
  });
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
 *
 * **The quiz product's routes are the second class (#300).** They are gated by
 * `product.quiz-surfaces`, which resolves on for `BRAND=quizhub` and off for `BRAND=alignsynch`, so
 * this one list gives both halves of the boundary: on the quiz build `hiddenNavHrefs()` shrinks to
 * `["/leaderboard"]` (every quiz href resolves on), and on the alignment build it carries all the
 * quiz roots — which is what the sidebar, the footer, the 404's suggestion row and the profile page
 * read instead of growing a brand check each. `tests/flags.test.ts` pins both answers per brand.
 *
 * It lists the **static roots** and the **route patterns** that a component matches a concrete
 * href against. A nav or footer row is always a concrete href (`/quiz/<id>`, `/categories/<slug>`),
 * which an exact-string list cannot answer for, and the surfaces that *draw* one of those — the
 * quiz cards, the footer's subject column, the profile's activity feed — need to know whether the
 * pattern behind it is gated. So both spellings live here, and a caller uses the one it has:
 * the sidebar asks about `/categories`, `components/profile/profile-activity.tsx` asks about
 * `/quiz/[id]` before building `/quiz/<relatedId>` (#300). Two vocabularies in one list beat a
 * second list that could disagree with this one.
 *
 * `/leaderboard` stays on its own flag: it is off on **both** brands until the boards are real, so
 * it is a mock gate as well as a quiz surface, and the brand gate is not what closes it.
 */
export const navSurfaces: Readonly<Record<string, FlagName>> = {
  "/leaderboard": "community.leaderboard",
  /**
   * `/affiliate` is the one quiz href whose nav row the **mock** gate owns (#291 follow-up), not
   * the brand boundary: `commerce.affiliate` is `default: false` on every template, so the
   * programme is unadvertised on both builds — which is what the route does too, since
   * `app/(mainlayout)/affiliate/page.tsx` calls `notFound()` while it is off, and the four
   * surfaces that still drew a row to it were handing a member a 404.
   *
   * The brand half did not go anywhere: that same page calls `requireQuizProduct()` (#300), so an
   * alignment build answers 404 whether or not the mock flag is on. One href maps to one flag
   * here, and the flag that turns the *route* off is the one that has to turn the row off — the
   * alternative (this entry on `product.quiz-surfaces`) is on for every quiz build, which is
   * exactly the dead link this fixes.
   *
   * The fixture, the route and `components/affiliate/**` all stay: the programme is a catalogue
   * asset, it is only unadvertised.
   */
  "/affiliate": "commerce.affiliate",
  "/daily-challenge": "product.quiz-surfaces",
  "/categories": "product.quiz-surfaces",
  "/categories/[slug]": "product.quiz-surfaces",
  "/battle": "product.quiz-surfaces",
  "/explore": "product.quiz-surfaces",
  "/explore/featured": "product.quiz-surfaces",
  "/tournaments": "product.quiz-surfaces",
  "/tournaments/[id]": "product.quiz-surfaces",
  "/creator-tips": "product.quiz-surfaces",
  "/creator-tips/[slug]": "product.quiz-surfaces",
  "/quiz-discussions": "product.quiz-surfaces",
  "/quiz/[id]": "product.quiz-surfaces",
  "/create/editor": "product.quiz-surfaces",
  "/create/generator": "product.quiz-surfaces",
  "/chat": "product.quiz-surfaces",
  "/dashboard/user": "product.quiz-surfaces",
  "/my-quizzes": "product.quiz-surfaces",
  "/my-quizzes/[id]": "product.quiz-surfaces",
};

/** The hrefs the shell must not draw. Empty when every gated surface is on. */
export function hiddenNavHrefs(): readonly string[] {
  return Object.entries(navSurfaces)
    .filter(([, name]) => !isEnabled(name))
    .map(([href]) => href);
}
