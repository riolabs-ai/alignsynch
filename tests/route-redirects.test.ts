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
import { relationshipTypes } from "@/data/relationship-types";
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

/** A redirect row, as `next.config.mjs` writes it: `permanent` and `statusCode` decide the answer. */
type RedirectRow = {
  source: string;
  destination: string;
  permanent?: boolean;
  statusCode?: number;
};

/** The list Next actually uses, resolved once — `redirects()` is async and takes no arguments. */
let redirects: readonly RedirectRow[] = [];

beforeAll(async () => {
  redirects = (await nextConfig.redirects?.()) ?? [];
});

/** The status Next answers with: an explicit `statusCode`, else `permanent` → 308, temporary → 307. */
function statusOf(entry: RedirectRow): number {
  return entry.statusCode ?? (entry.permanent ? 308 : 307);
}

/** `:param` substituted from a matched source — what the browser is actually sent to. */
function destinationOf(entry: RedirectRow, params: Record<string, string>): string {
  return entry.destination.replace(
    /:([A-Za-z0-9_]+)/g,
    (_match, key: string) => params[key] ?? `:${key}`,
  );
}

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

  /**
   * #794 — one address per row of the spec's old → new table, and each of them a **permanent** 308.
   *
   * The rules above answer "does this list shadow a page" and "does every destination resolve".
   * Neither asks the question a bookmark asks: *did this address move, to where, and will a browser
   * stop asking?* A dropped row, a `permanent: false` row (a 307 keeps the old URL in the tab and the
   * index), and a row pointed one segment short all pass those two rules, and all three are the
   * defect this migration exists to prevent.
   *
   * The old address is written out, not composed from a helper: this is the table a reader compares
   * against the issue, and a test that derived it from `lib/flow/paths.ts` would agree with the
   * implementation by construction instead of proving it. The three `POST` rows are listed like the
   * rest — a `redirects()` entry is method-agnostic, so the navigation that follows a form moves too.
   */
  const MOVED_ADDRESSES: readonly (readonly [oldPath: string, newPath: string])[] = [
    ["/assessment/templates", "/templates/relationship"],
    ["/assessment/templates/new", "/templates/relationship/new"],
    ["/assessment/templates/save", "/templates/relationship/save"],
    ["/assessment/templates/spouses", "/templates/relationship/spouses"],
    ["/assessment/templates/spouses/status", "/templates/relationship/spouses/status"],
    ["/assessment/templates/spouses/duplicate", "/templates/relationship/spouses/duplicate"],
    ["/assessment/templates/spouses/create", "/templates/relationship/spouses/create"],
    ["/assessment/templates/spouses/create/mode", "/templates/relationship/spouses/create/mode"],
    [
      "/assessment/templates/spouses/create/aspects",
      "/templates/relationship/spouses/create/aspects",
    ],
    [
      "/assessment/templates/spouses/create/commit",
      "/templates/relationship/spouses/create/commit",
    ],
    [
      "/assessment/templates/spouses/create/account",
      "/templates/relationship/spouses/create/account",
    ],
    ["/templates", "/relationship-types"],
    ["/templates/spouses", "/relationship-types/spouses"],
  ];

  it("answers every old address in the #794 table with a permanent 308", () => {
    const failures: string[] = [];

    for (const [oldPath, newPath] of MOVED_ADDRESSES) {
      const matches = redirects.filter((entry) => matcherFor(entry.source)(oldPath) !== false);

      // `next.config.mjs` lists the literal rows before `:slug`, and Next takes the **first** match,
      // so `/assessment/templates/new` is answered by the literal row while `:slug` would also have
      // matched it. The row Next uses is the one asserted; an empty match is the failure.
      if (matches.length === 0) {
        failures.push(`${oldPath} → no row matches`);
        continue;
      }

      const entry = matches[0];
      const matched = matcherFor(entry.source)(oldPath);
      const params = matched === false ? {} : matched.params;

      if (statusOf(entry) !== 308) {
        failures.push(`${oldPath} answers ${statusOf(entry)}, not 308 (${entry.source})`);
      }
      if (destinationOf(entry, params) !== newPath) {
        failures.push(
          `${oldPath} → ${destinationOf(entry, params)}, expected ${newPath} (${entry.source})`,
        );
      }
    }

    expect(failures).toEqual([]);
  });

  /**
   * And the table is the whole family, not a sample: every redirect row under `/templates` is
   * exercised by an address above. A row added to `next.config.mjs` without a row here is a move
   * nothing proves, which is how a redirect can land green and send a bookmark nowhere.
   */
  it("exercises every /templates redirect row — the table is not a sample", () => {
    const unproven = redirects
      .filter((entry) => entry.source.startsWith("/templates"))
      .filter(
        (entry) =>
          !MOVED_ADDRESSES.some(([oldPath]) => matcherFor(entry.source)(oldPath) !== false),
      )
      .map((entry) => `${entry.source} → ${entry.destination}`);

    expect(unproven).toEqual([]);
  });

  /**
   * #794 — the addresses the move created belong to the tree, not to a redirect.
   *
   * A redirect that catches its own destination is the shadow rule in a different coat, and it is
   * not hypothetical: a bare `/templates/:typeId` row matched `/templates/relationship` and 308'd the
   * library to a 404. `ROUTE_PATTERNS` covers pages only, so the three `POST` addresses — which live
   * in `app/` as `route.ts` — need the handler tree as well; the patterns are asserted against the
   * tree and then asked of every redirect, so a route that moves again fails here by name.
   */
  const NEW_PAGES = [
    "/templates/relationship",
    "/templates/relationship/new",
    "/templates/relationship/[slug]",
    "/templates/relationship/[slug]/create",
    "/templates/relationship/[slug]/create/mode",
    "/templates/relationship/[slug]/create/aspects",
    "/templates/relationship/[slug]/create/commit",
    "/templates/relationship/[slug]/create/account",
    "/relationship-types",
    "/relationship-types/[slug]",
  ] as const;

  const NEW_HANDLERS = [
    "/templates/relationship/save",
    "/templates/relationship/[slug]/status",
    "/templates/relationship/[slug]/duplicate",
  ] as const;

  it("leaves the new #794 addresses to the tree, not to a redirect", () => {
    const handlers = routeHandlerPatterns();
    const missing = [
      ...NEW_PAGES.filter((pattern) => !ROUTE_PATTERNS.includes(pattern)),
      ...NEW_HANDLERS.filter((pattern) => !handlers.includes(pattern)),
    ];
    expect(missing).toEqual([]);

    const caught: string[] = [];
    for (const pattern of [...NEW_PAGES, ...NEW_HANDLERS]) {
      const live = samplePathOf(pattern);
      for (const entry of redirects) {
        if (matcherFor(entry.source)(live) !== false) {
          caught.push(`${entry.source} → ${entry.destination} catches ${live}`);
        }
      }
    }

    expect(caught).toEqual([]);
  });

  /**
   * The worked example's old address — the last surface #794 left hanging off the record *kind*.
   *
   * `assessmentDemoPath()` is gone and the report lives at `/relationship-types/[slug]/demo`, so
   * the only thing keeping a bookmark, an external link or cached markup working is the redirect
   * row. The two rules above say nothing about it: `:type` is a *param* source, so the static
   * comparison cannot see it, and "destination resolves" does not ask whether the old address still
   * answers. A dropped row, a `permanent: false` row and a row pointed one segment short all leave
   * those two rules green.
   *
   * The row is **one segment wide on purpose**. `/assessment/demo/<type>/junk` has never answered
   * anything, and a `:path*` row would 308 it into a 404 — the judgment that removed
   * `/testimonials/jessica.png`. The same width is what keeps `/assessment/instances/**` out of it:
   * a row written one segment up (`/assessment/:kind/:type`) would catch the instance pages, and
   * they do not move in this pass.
   */
  const DEMO_OLD_ROOT = "/assessment/demo";

  /** The row Next takes for an old demo address, or undefined — first match wins, as Next does. */
  function demoRedirectFor(oldPath: string): RedirectRow | undefined {
    return redirects.find((entry) => matcherFor(entry.source)(oldPath) !== false);
  }

  /** The address a matched row sends a browser to, params substituted. */
  function redirectedTo(entry: RedirectRow, oldPath: string): string {
    const matched = matcherFor(entry.source)(oldPath);
    return destinationOf(entry, matched === false ? {} : matched.params);
  }

  it("answers the old worked-example address with a permanent 308 to the new one", () => {
    // Not one spelling: every type in the catalogue, because the row is a param and a matching
    // count of one would prove nothing about the other 34. The ids come from the fixture, so a
    // type added there is exercised without editing this table.
    expect(relationshipTypes.length).toBeGreaterThan(1);
    const failures: string[] = [];

    for (const type of relationshipTypes) {
      const oldPath = `${DEMO_OLD_ROOT}/${type.id}`;
      const expected = `/relationship-types/${type.id}/demo`;
      const entry = demoRedirectFor(oldPath);

      if (!entry) {
        failures.push(`${oldPath} → no row matches`);
        continue;
      }
      if (statusOf(entry) !== 308) {
        failures.push(`${oldPath} answers ${statusOf(entry)}, not 308 (${entry.source})`);
      }
      if (redirectedTo(entry, oldPath) !== expected) {
        failures.push(`${oldPath} → ${redirectedTo(entry, oldPath)}, expected ${expected}`);
      }
    }

    expect(failures).toEqual([]);
  });

  /**
   * And the destination is a page, not a hop to a 404: the report's own address has to be in the
   * tree the redirect points into. `content/routes.ts` is the manifest `data:check` holds equal to
   * `app/`, so asserting the pattern here is asserting the page exists.
   */
  it("points the old demo address at a live page", () => {
    expect(ROUTE_PATTERNS).toContain("/relationship-types/[slug]/demo");
    expect(matchRoute(routeManifest, "/relationship-types/staff-manager/demo")).toBeTruthy();
  });

  it("does not catch a path below the old demo address — the row is one segment", () => {
    // Nothing lives under `/assessment/demo`, so nothing is owed a redirect below it. A wildcard
    // would answer a 404 with a 308 to a second 404.
    for (const path of ["/assessment/demo", "/assessment/demo/staff-manager/junk"]) {
      expect(demoRedirectFor(path)).toBeUndefined();
    }
  });

  it("exercises every /assessment/demo redirect row — the table is not a sample", () => {
    const unproven = redirects
      .filter((entry) => entry.source.startsWith(DEMO_OLD_ROOT))
      .filter(
        (entry) =>
          !relationshipTypes.some(
            (type) => matcherFor(entry.source)(`${DEMO_OLD_ROOT}/${type.id}`) !== false,
          ),
      )
      .map((entry) => `${entry.source} → ${entry.destination}`);

    expect(unproven).toEqual([]);
  });

  /**
   * `/assessment/instances/**` is the part of the `assessment` tree that stays — it is a record
   * page, not a template and not a taxonomy, so the demo move has no business touching it. Its
   * patterns are read out of the manifest rather than listed, so a page added under it is covered
   * without editing this case.
   */
  it("leaves every /assessment/instances address to the tree", () => {
    const instances = ROUTE_PATTERNS.filter(
      (pattern) =>
        pattern === "/assessment/instances" || pattern.startsWith("/assessment/instances/"),
    );
    // The family is two static addresses and a dynamic one; a filter that silently matched nothing
    // would make the loop below vacuous.
    expect(instances.length).toBeGreaterThan(1);

    const caught: string[] = [];
    for (const pattern of instances) {
      const live = samplePathOf(pattern);
      for (const entry of redirects) {
        if (matcherFor(entry.source)(live) !== false) {
          caught.push(`${entry.source} → ${entry.destination} catches ${live}`);
        }
      }
    }

    expect(caught).toEqual([]);
  });
});
