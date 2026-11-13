/**
 * `pnpm qa:links` is an authoring aid, and an aid that is wrong is worse than none: a link that
 * 404s, an admin screen offered to a member, or a route invented for a component that reaches no
 * page all cost the person QAing more time than writing the list by hand (#863).
 *
 * So the derivations are pure functions and they are driven here — no git, no browser, no server:
 *
 *   1. **tests every shape** of the three derivations: a page is its route, a layout is its subtree,
 *      a component is the routes that import it, a fixture is its budget row, and a file that
 *      reaches nothing is named as such instead of pointed at the nearest page.
 *   2. **the table is held against the tree** (`the tree` cases read `app/**`): the auth class this
 *      script prints is the one `lib/auth/require-role.ts::roleAnswerFor()` enforces, and the
 *      quiz-only marker is exactly the pages that call `requireQuizProduct()`. A new admin screen
 *      that nobody classifies fails here rather than in a QA session.
 *   3. **the manifest is the boundary**: a page whose route `content/routes.ts` does not carry is a
 *      failure that names the file, and every one of the tree's pages resolves.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { stripComments } from "../scripts/client-graph";
import { entriesReaching, reachability } from "../scripts/module-reach";
import {
  AUTH_CLASS_TABLE,
  authBadge,
  authClassFor,
  count,
  deriveRoutes,
  isLayoutPath,
  isQuizOnly,
  issueFromBody,
  issueFromSubject,
  modulePathOf,
  pagesUnderTree,
  prefixMatches,
  QUIZ_ONLY_PREFIXES,
  reasonForUnrouted,
  routeForPagePath,
  routesForEntry,
  SHARED_REACH_LIMIT,
  treeOfLayoutPath,
  urlFor,
  type DerivationInput,
} from "../scripts/qa-links";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/* ------------------------------------------------------------------ *
 * 1 — the derivations
 * ------------------------------------------------------------------ */

describe("routeForPagePath", () => {
  it("strips the group and keeps a dynamic segment as written", () => {
    expect(routeForPagePath("app/(marketing)/page.tsx")).toBe("/");
    expect(routeForPagePath("app/(mainlayout)/admin/audit/page.tsx")).toBe("/admin/audit");
    expect(routeForPagePath("app/(mainlayout)/assessment/[slug]/page.tsx")).toBe(
      "/assessment/[slug]",
    );
    expect(routeForPagePath("app/(mainlayout)/templates/relationship/[slug]/create/page.tsx")).toBe(
      "/templates/relationship/[slug]/create",
    );
  });

  it("answers null for everything that is not a page — a layout is not a route", () => {
    expect(routeForPagePath("app/(mainlayout)/layout.tsx")).toBeNull();
    expect(routeForPagePath("app/layout.tsx")).toBeNull();
    expect(routeForPagePath("app/not-found.tsx")).toBeNull();
    expect(routeForPagePath("app/globals.css")).toBeNull();
    expect(routeForPagePath("components/home/as2-home.tsx")).toBeNull();
    expect(routeForPagePath("app/(mainlayout)/templates/relationship/save/route.ts")).toBeNull();
  });
});

describe("routesForEntry", () => {
  const pages = [
    "app/(mainlayout)/admin/console/page.tsx",
    "app/(mainlayout)/admin/console/users/page.tsx",
    "app/(mainlayout)/admin/audit/page.tsx",
    "app/(marketing)/page.tsx",
  ];

  it("a page speaks for itself", () => {
    expect(routesForEntry("app/(mainlayout)/admin/audit/page.tsx", pages)).toEqual([
      "/admin/audit",
    ]);
  });

  it("a layout speaks for its subtree and stops at a sibling", () => {
    const tree = treeOfLayoutPath("app/(mainlayout)/admin/console/layout.tsx");
    expect(tree).toBe("app/(mainlayout)/admin/console");
    expect(routesForEntry("app/(mainlayout)/admin/console/layout.tsx", pages)).toEqual([
      "/admin/console",
      "/admin/console/users",
    ]);
    expect(routesForEntry("app/(mainlayout)/layout.tsx", pages)).toEqual([
      "/admin/audit",
      "/admin/console",
      "/admin/console/users",
    ]);
    // `/` is `app/(marketing)/page.tsx`, which the shell's layout does not wrap.
    expect(routesForEntry("app/layout.tsx", pages)).toContain("/");
  });

  it("a file that is neither entry speaks for nothing", () => {
    expect(routesForEntry("components/home/as2-home.tsx", pages)).toEqual([]);
  });

  it("pagesUnderTree does not match a name that merely starts the same", () => {
    expect(pagesUnderTree("app/(mainlayout)/admin/cons", pages)).toEqual([]);
    expect(isLayoutPath("app/(mainlayout)/admin/console/layout.tsx")).toBe(true);
    expect(isLayoutPath("app/layout.tsx")).toBe(true);
    expect(isLayoutPath("app/(mainlayout)/admin/console/page.tsx")).toBe(false);
  });
});

describe("issueFromSubject", () => {
  it("reads the first (#n) as the issue and ignores the pull request that follows it", () => {
    expect(issueFromSubject("feat(home): the AS2 front page at / (#853) (#857)")).toBe(853);
    expect(
      issueFromSubject(
        "feat(billing): the publish trial is the Advanced entitlement (#835) (#859)",
      ),
    ).toBe(835);
  });

  it("answers null when the commit claims no issue", () => {
    expect(issueFromSubject("chore: bump the lockfile")).toBeNull();
    expect(issueFromSubject("fix: a #12 inside prose is not a subject tag")).toBeNull();
  });
});

describe("issueFromBody", () => {
  it("prefers the close keyword over a stray reference", () => {
    expect(issueFromBody("Touches #861 and closes #863.")).toBe(863);
    expect(issueFromBody("Closes: #42")).toBe(42);
    expect(issueFromBody("Fixes #7, see also #9")).toBe(7);
  });

  it("falls back to the first reference, and answers null for a body with none", () => {
    expect(issueFromBody("Part of #853")).toBe(853);
    expect(issueFromBody("no reference here")).toBeNull();
  });
});

/** A derivation input over a fake tree, so every case is one assertion instead of one repo. */
function fake(overrides: {
  changed: readonly string[];
  pages?: readonly string[];
  routes?: readonly string[];
  fixtureRoutes?: Record<string, string>;
  reaches?: Record<string, readonly string[]>;
}): DerivationInput {
  const pages = overrides.pages ?? [];
  const reaches = overrides.reaches ?? {};
  return {
    changed: overrides.changed,
    pages,
    knownRoutes: new Set(overrides.routes ?? ["/", "/dashboard", "/admin/audit", "/quiz/[id]"]),
    fixtureRoutes: overrides.fixtureRoutes ?? {},
    entriesFor: (file) => reaches[file] ?? [],
  };
}

describe("deriveRoutes", () => {
  it("a changed page is its own route", () => {
    const result = deriveRoutes(fake({ changed: ["app/(marketing)/page.tsx"] }));
    expect(result.links).toEqual([
      { route: "/", via: "page", files: ["app/(marketing)/page.tsx"] },
    ]);
    expect(result.missing).toEqual([]);
  });

  it("a changed page the manifest does not carry is a failure that names the file", () => {
    const file = "app/(mainlayout)/qa-bogus/page.tsx";
    const result = deriveRoutes(fake({ changed: [file] }));
    expect(result.missing).toEqual([{ file, route: "/qa-bogus" }]);
    expect(result.links).toEqual([]);
  });

  it("a changed layout reaches every page beneath it", () => {
    const result = deriveRoutes(
      fake({
        changed: ["app/(mainlayout)/dashboard/layout.tsx"],
        pages: ["app/(mainlayout)/dashboard/page.tsx", "app/(mainlayout)/admin/audit/page.tsx"],
      }),
    );
    expect(result.links.map((link) => link.route)).toEqual(["/dashboard"]);
    expect(result.links[0]?.via).toBe("layout");
  });

  it("a changed component reaches the routes that import it", () => {
    const result = deriveRoutes(
      fake({
        changed: ["components/dashboard/earnings-chart.tsx"],
        reaches: {
          "components/dashboard/earnings-chart.tsx": ["app/(mainlayout)/dashboard/page.tsx"],
        },
      }),
    );
    expect(result.links).toEqual([
      {
        route: "/dashboard",
        via: "import",
        files: ["components/dashboard/earnings-chart.tsx"],
      },
    ]);
  });

  it("a component a layout renders reaches the layout's routes", () => {
    const result = deriveRoutes(
      fake({
        changed: ["components/layout/sidebar.tsx"],
        pages: ["app/(mainlayout)/dashboard/page.tsx"],
        reaches: { "components/layout/sidebar.tsx": ["app/(mainlayout)/layout.tsx"] },
      }),
    );
    expect(result.links.map((link) => link.route)).toEqual(["/dashboard"]);
  });

  it("a component that reaches more than the shared limit is a shared line, not a checkbox", () => {
    const pages = Array.from(
      { length: SHARED_REACH_LIMIT + 1 },
      (_, index) => `app/(mainlayout)/screen-${index}/page.tsx`,
    );
    const routes = pages.map((_, index) => `/screen-${index}`);
    const result = deriveRoutes({
      changed: ["content/brand.ts"],
      pages,
      knownRoutes: new Set(routes),
      fixtureRoutes: {},
      entriesFor: () => pages,
    });
    expect(result.links).toEqual([]);
    expect(result.shared).toEqual([
      { file: "content/brand.ts", pages: SHARED_REACH_LIMIT + 1, of: pages.length },
    ]);
    expect(result.unrouted).toEqual([]);
  });

  it("a component no entry reaches is not a route, and says so", () => {
    const result = deriveRoutes(fake({ changed: ["components/dashboard/dashboard-page.tsx"] }));
    expect(result.links).toEqual([]);
    expect(result.unrouted).toEqual([
      { file: "components/dashboard/dashboard-page.tsx", reason: "a module no page reaches" },
    ]);
  });

  it("a data/pages fixture reaches its budget row's page even when no import names it", () => {
    const result = deriveRoutes(
      fake({
        changed: ["data/pages/admin-audit.ts"],
        fixtureRoutes: { "data/pages/admin-audit": "/admin/audit" },
      }),
    );
    expect(result.links).toEqual([
      { route: "/admin/audit", via: "fixture", files: ["data/pages/admin-audit.ts"] },
    ]);
  });

  it("one route named by two files is one link carrying both", () => {
    const result = deriveRoutes(
      fake({
        changed: ["app/(marketing)/page.tsx", "components/home/as2-hero.tsx"],
        reaches: { "components/home/as2-hero.tsx": ["app/(marketing)/page.tsx"] },
      }),
    );
    expect(result.links).toHaveLength(1);
    expect(result.links[0]?.files).toEqual([
      "app/(marketing)/page.tsx",
      "components/home/as2-hero.tsx",
    ]);
  });

  it("modulePathOf strips the extension the budget row does not carry", () => {
    expect(modulePathOf("data/pages/home.ts")).toBe("data/pages/home");
    expect(modulePathOf("lib/utils.tsx")).toBe("lib/utils");
    expect(modulePathOf("scripts/qa-links.mjs")).toBe("scripts/qa-links");
  });
});

describe("reasonForUnrouted", () => {
  it("names the reason a file cannot be clicked", () => {
    expect(reasonForUnrouted("app/globals.css")).toContain("every route renders through it");
    expect(reasonForUnrouted("tailwind.config.ts")).toContain("every route renders through it");
    expect(reasonForUnrouted("app/(mainlayout)/invite/[token]/claim/route.ts")).toContain(
      "route handler",
    );
    expect(reasonForUnrouted("tests/qa-links.test.ts")).toBe("a test");
    expect(reasonForUnrouted("package.json")).toContain("dependency manifest");
    expect(reasonForUnrouted("docs/qa/qa-links.md")).toBe("documentation");
    expect(reasonForUnrouted("public/home/personal-life.avif")).toBe("a static asset");
    expect(reasonForUnrouted("scripts/qa-links.ts")).toBe("a tooling script");
    expect(reasonForUnrouted("data/billing-plans.ts")).toBe("a fixture no page reaches");
    expect(reasonForUnrouted("lib/flow/store.ts")).toBe("a module no page reaches");
  });
});

/* ------------------------------------------------------------------ *
 * 2 — the auth class and the brand boundary
 * ------------------------------------------------------------------ */

describe("authClassFor", () => {
  it("marks the console admin, the member's own screens member, the rest public", () => {
    expect(authClassFor("/admin/console/users").auth).toBe("admin");
    expect(authClassFor("/admin/instances/[id]/report").auth).toBe("admin");
    expect(authClassFor("/demo/admin").auth).toBe("admin");
    expect(authClassFor("/dashboard/templates/[id]").auth).toBe("member");
    expect(authClassFor("/settings").auth).toBe("member");
    expect(authClassFor("/").auth).toBe("public");
    expect(authClassFor("/pricing").auth).toBe("public");
  });

  it("lets the longest prefix win, so an exception beats the group above it", () => {
    expect(authClassFor("/support").auth).toBe("member");
    expect(authClassFor("/support/articles/[slug]").auth).toBe("public");
    expect(authClassFor("/templates/relationship/[slug]").auth).toBe("member");
    expect(authClassFor("/templates/relationship/[slug]/create").auth).toBe("public");
    expect(authClassFor("/assessment/instances").auth).toBe("member");
    expect(authClassFor("/assessment/instances/[instanceId]/answer").auth).toBe("public");
  });

  it("matches a prefix on a segment, never inside one", () => {
    expect(prefixMatches("/quiz/[id]/play", "/quiz")).toBe(true);
    expect(prefixMatches("/quiz", "/quiz")).toBe(true);
    expect(prefixMatches("/quiz-discussions", "/quiz")).toBe(false);
  });

  it("declares each prefix once", () => {
    const prefixes = AUTH_CLASS_TABLE.map((row) => row.prefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it("tells a member what an admin link will do, and marks the brand's 404s", () => {
    expect(authBadge("/admin/audit")).toContain("404 as a member");
    expect(authBadge("/dashboard")).toContain("sign in first");
    expect(authBadge("/categories")).toContain("quiz-only — 404 on this brand");
    expect(authBadge("/quiz/[id]")).toContain("substitute a real id");
  });
});

describe("isQuizOnly", () => {
  it("marks the twenty-two routes the quiz product owns", () => {
    for (const route of [
      "/affiliate",
      "/battle",
      "/categories",
      "/categories/[slug]",
      "/chat",
      "/create/editor",
      "/creator-tips/[slug]",
      "/daily-challenge",
      "/dashboard/user",
      "/explore/featured",
      "/my-quizzes/[id]/statistics",
      "/quiz/[id]/discussion",
      "/quiz-discussions",
      "/tournaments",
    ]) {
      expect(isQuizOnly(route), route).toBe(true);
    }
  });

  it("leaves the alignment product's own screens alone", () => {
    for (const route of ["/", "/dashboard", "/assessment/[slug]", "/pricing", "/admin/audit"]) {
      expect(isQuizOnly(route), route).toBe(false);
    }
    expect(isQuizOnly("/quiz-bank")).toBe(false);
  });
});

describe("urlFor", () => {
  it("joins one slash, never two", () => {
    expect(urlFor("http://localhost:3001", "/")).toBe("http://localhost:3001/");
    expect(urlFor("http://localhost:3001/", "/dashboard")).toBe("http://localhost:3001/dashboard");
  });
});

describe("count", () => {
  it("agrees with its noun, because a list is read as prose", () => {
    expect(count(1, "route")).toBe("1 route");
    expect(count(3, "route")).toBe("3 routes");
    expect(count(0, "file")).toBe("0 files");
  });
});

/* ------------------------------------------------------------------ *
 * 3 — the tree: the table, the marker and the manifest
 * ------------------------------------------------------------------ */

/** Every source file under `app/`, repo-relative. */
function appFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(`${ROOT}${dir}`, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name)) found.push(path);
    }
  };
  walk("app");
  return found.sort();
}

function code(path: string): string {
  return stripComments(readFileSync(`${ROOT}${path}`, "utf8"));
}

const APP_FILES = appFiles();
const PAGE_FILES = APP_FILES.filter((path) => routeForPagePath(path) !== null);
/** Every route the tree's pages serve, sorted. */
const ROUTE_PATHS = PAGE_FILES.map((page) => routeForPagePath(page) as string).sort();

/** The gates a route stands behind: its page's, and every layout above it. */
function gatesFor(page: string): string {
  const layouts = APP_FILES.filter(
    (path) => isLayoutPath(path) && page.startsWith(`${treeOfLayoutPath(path)}/`),
  );
  return [page, ...layouts].map((path) => code(path)).join("\n");
}

function routesWhere(test: (source: string) => boolean): string[] {
  return PAGE_FILES.filter((page) => test(gatesFor(page)))
    .map((page) => routeForPagePath(page) as string)
    .sort();
}

describe("the tree", () => {
  it("every page serves a route content/routes.ts carries, so the list can never invent one", () => {
    const manifest = readFileSync(`${ROOT}content/routes.ts`, "utf8");
    const patterns = [...manifest.matchAll(/^\s*"(\/[^"]*)",$/gm)].map(
      (match) => match[1] as string,
    );
    const known = new Set(patterns);
    const unknown = PAGE_FILES.filter((page) => !known.has(routeForPagePath(page) as string));
    expect(unknown, "pages whose route the manifest does not carry").toEqual([]);
    expect(PAGE_FILES.length).toBeGreaterThan(80);
  });

  it("every page that gates admin (or the support rung) is classified admin", () => {
    const gated = routesWhere(
      (source) =>
        /\brequireAdmin\s*\(/.test(source) ||
        /requireRole\(\s*["'](?:admin|support)["']/.test(source),
    );
    expect(gated.length).toBeGreaterThan(10);
    for (const route of gated) {
      expect(authClassFor(route).auth, route).toBe("admin");
    }
  });

  it("every page that gates member is classified member", () => {
    const gated = routesWhere((source) => /requireRole\(\s*["']member["']/.test(source));
    expect(gated.length).toBeGreaterThan(5);
    for (const route of gated) {
      expect(authClassFor(route).auth, route).toBe("member");
    }
  });

  it("the quiz product's routes are exactly the pages that call requireQuizProduct()", () => {
    const gated = routesWhere((source) => /\brequireQuizProduct\s*\(/.test(source));
    // Every gated route is marked…
    expect(gated.filter((route) => isQuizOnly(route))).toEqual(gated);
    // …and the marker claims no route the tree does not gate.
    expect(ROUTE_PATHS.filter((route) => isQuizOnly(route))).toEqual(gated);
    for (const prefix of QUIZ_ONLY_PREFIXES) {
      expect(
        gated.some((route) => prefixMatches(route, prefix)),
        prefix,
      ).toBe(true);
    }
  });

  it("the leaderboard is flagged off, which is why the list marks it admin", () => {
    const page = PAGE_FILES.find((path) => routeForPagePath(path) === "/leaderboard") as string;
    expect(code(page)).toContain("enabledForCaller");
    expect(authClassFor("/leaderboard").auth).toBe("admin");
  });
});

/** Every route the manifest carries, for the prefix-coverage case above. */

/* ------------------------------------------------------------------ *
 * 4 — the walk itself
 * ------------------------------------------------------------------ */

describe("reachability", () => {
  const sources = {
    "app/(mainlayout)/dashboard/page.tsx":
      'import { Chart } from "@/components/chart";\nimport type { Row } from "@/types";\nexport default Chart;\n',
    "components/chart.tsx":
      'import { format } from "@/lib/format";\nexport const Chart = format;\n',
    "lib/format.ts": "export const format = (value: number) => value;\n",
    "types.ts": "export interface Row { id: string }\n",
    "components/orphan.tsx": "export const orphan = 1;\n",
    "app/(mainlayout)/layout.tsx":
      'import { Sidebar } from "@/components/sidebar";\nexport default Sidebar;\n',
    "components/sidebar.tsx": "export const Sidebar = 1;\n",
  };
  const reach = reachability({
    sources,
    entries: ["app/(mainlayout)/dashboard/page.tsx", "app/(mainlayout)/layout.tsx"],
  });

  it("a value import is a reach", () => {
    expect(entriesReaching(reach, "components/chart.tsx")).toEqual([
      "app/(mainlayout)/dashboard/page.tsx",
    ]);
  });

  it("the walk is transitive", () => {
    expect(entriesReaching(reach, "lib/format.ts")).toEqual([
      "app/(mainlayout)/dashboard/page.tsx",
    ]);
  });

  it("a type-only import is erased and reaches nothing", () => {
    expect(entriesReaching(reach, "types.ts")).toEqual([]);
  });

  it("a layout is an entry, so the shell's components are not orphans", () => {
    expect(entriesReaching(reach, "components/sidebar.tsx")).toEqual([
      "app/(mainlayout)/layout.tsx",
    ]);
  });

  it("a module nothing imports reaches nothing", () => {
    expect(entriesReaching(reach, "components/orphan.tsx")).toEqual([]);
    expect(entriesReaching(reach, "components/chart.tsx").length).toBe(1);
  });
});
