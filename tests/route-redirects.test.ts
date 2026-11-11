/**
 * A redirect may not shadow a page (Console 2/5).
 *
 * `next.config.mjs`'s `redirects()` runs **before** the filesystem route, so an entry whose
 * `source` is also a page in `app/` wins: the page is built, typechecked, rendered into `.next` and
 * unreachable, and every "does this route work" check that renders the page module directly stays
 * green. That is not hypothetical — `/dashboard` carried
 * `{ source: "/dashboard", destination: "/dashboard/user", permanent: true }` from the pre-P1 shell,
 * and the console's Overview was answered with a 308 to the quiz account home on both brands while
 * `next build` listed it as a route.
 *
 * Two rules, both about the list rather than about any one entry:
 *
 *   * a **static** `source` that is a route pattern in `content/routes.ts` is a dead surface — the
 *     page exists, and the redirect hides it. Static sources only: `/support/articles/kb-:slug` is
 *     a legacy *shape*, not a path, and no page can claim it;
 *   * every `destination` must resolve — to a route pattern, or to the kind of page-shaped path a
 *     pattern covers (`/dashboard/user?tab=wallet`).
 *
 * The redirects still have their job: a bookmark, an external link or cached markup that points at
 * a path the tree never had should not land on a 404. That is what the survivors are for.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, sep } from "node:path";

import { matchRoute } from "@/content/route-manifest";
import { ROUTE_PATTERNS, routeManifest } from "@/content/routes";
import nextConfig from "@/next.config.mjs";

/**
 * Next's own source matcher.
 *
 * `content/route-manifest.ts` matches the *manifest*'s `[param]` spelling; a redirect `source` is a
 * path-to-regexp pattern and the two are not the same language, so a rule about one cannot be
 * written with the other. This is the exact compiled build Next uses for `redirects()`, required
 * rather than re-implemented: a hand-written matcher here would be a second opinion about what
 * Next does, which is the thing the rule exists to check.
 */
const nodeRequire = createRequire(import.meta.url);
const { match: matchSource } = nodeRequire("next/dist/compiled/path-to-regexp") as {
  match: (
    source: string,
    options: { decode: (value: string) => string },
  ) => (path: string) => { params: Record<string, string> } | false;
};

/** A redirect source → the matcher Next builds from it. */
function matcherFor(source: string): (path: string) => { params: Record<string, string> } | false {
  return matchSource(source, { decode: decodeURIComponent });
}

/** The list Next actually uses, resolved once — `redirects()` is async and takes no arguments. */
let redirects: readonly { source: string; destination: string }[] = [];

beforeAll(async () => {
  redirects = (await nextConfig.redirects?.()) ?? [];
});

/** A destination with its query string removed: `matchRoute` matches paths, not parameters. */
function pathOf(destination: string): string {
  return destination.split("?")[0] ?? destination;
}

/**
 * A live route pattern as a concrete path: one neutral segment per `[param]`.
 *
 * The sample segment is deliberately dull (`sample`) so it cannot accidentally satisfy a
 * redirect's own literal — what is being asked is "does this redirect catch *any* request that a
 * page answers", and a page answers every spelling of its param.
 */
function samplePathOf(pattern: string): string {
  return pattern.replace(/\[[^\]]+\]/g, "sample");
}

/** The same pattern in path-to-regexp's spelling, so `matcherFor` can compile it. */
function sourceOf(pattern: string): string {
  return pattern.replace(/\[([^\]]+)\]/g, ":$1");
}

/**
 * Every **POST-only route handler** under `app/`, as a route pattern.
 *
 * The manifest lists *pages* (`data:check` holds it equal to the `page.tsx` tree in both
 * directions), so a redirect whose destination is a handler — `…/[slug]/status`, `…/[slug]/duplicate`
 * — has no manifest row to resolve against even though the path is real. A destination is dead
 * when nothing in `app/` answers it, so both trees are the answer.
 */
function routeHandlerPatterns(root = "app"): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
      const child = join(dir, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.name === "route.ts") {
        const segments = relative(join(process.cwd(), "app"), join(process.cwd(), child))
          .split(sep)
          .slice(0, -1)
          // A route group — `(mainlayout)`, `(auth)` — is not a URL segment.
          .filter((segment) => !/^\(.+\)$/.test(segment));
        found.push(`/${segments.join("/")}`);
      }
    }
  };
  walk(root);
  return found;
}

describe("the legacy redirects", () => {
  it("has entries to check, so the rule is not vacuous", () => {
    expect(redirects.length).toBeGreaterThan(0);
  });

  it("never shadows a page — no static source is a live route", () => {
    const shadowing = redirects
      .filter((entry) => !entry.source.includes(":"))
      .filter((entry) => ROUTE_PATTERNS.includes(entry.source));

    expect(shadowing).toEqual([]);
  });

  it("points every destination at a route the manifest can match", () => {
    const handlers = routeHandlerPatterns().map(sourceOf);
    const resolves = (path: string): boolean =>
      matchRoute(routeManifest, path) !== undefined ||
      handlers.some((pattern) => matcherFor(pattern)(path) !== false);

    const dead = redirects.filter((entry) => !resolves(pathOf(entry.destination)));

    expect(dead).toEqual([]);
  });

  /**
   * The same rule, for the rows the static check above cannot see.
   *
   * A **dynamic** source is not exempt from shadowing a page — it is exempt from being *caught* by
   * a string comparison. `/templates/:typeId` matched `/templates/relationship`, the library's own
   * address, and 308'd it to a 404 while every check stayed green: redirects run before the
   * filesystem route, so the page was built and unreachable. That row now carries a negative
   * lookahead; this compiles each source with Next's own matcher and asks every live route, so the
   * exclusion cannot be dropped by a future edit that has no test in front of it.
   */
  it("never shadows a page — no dynamic source matches a live route", () => {
    const shadowing: string[] = [];
    for (const pattern of ROUTE_PATTERNS) {
      const live = samplePathOf(pattern);
      for (const entry of redirects) {
        if (matcherFor(entry.source)(live) !== false) {
          shadowing.push(
            `${entry.source} → ${entry.destination} catches live ${pattern} (${live})`,
          );
        }
      }
    }

    expect(shadowing).toEqual([]);
  });

  /**
   * And the row that rule protects is still doing its job: the catalogue's old addresses move, the
   * library's new ones do not. A lookahead that excluded too much would be as wrong as none.
   */
  it("moves the old catalogue addresses and leaves the library where it is", () => {
    const catalogue = redirects.filter((entry) => entry.source.startsWith("/templates"));
    const hits = (path: string) =>
      catalogue
        .filter((entry) => matcherFor(entry.source)(path) !== false)
        .map((e) => e.destination);

    expect(hits("/templates/spouses")).toEqual(["/relationship-types/:typeId"]);
    expect(hits("/templates/relationship")).toEqual([]);
    expect(hits("/templates/relationship/new")).toEqual([]);
    expect(hits("/templates/relationship/spouses")).toEqual([]);
    expect(hits("/templates/relationship/spouses/create/mode")).toEqual([]);
  });
});
