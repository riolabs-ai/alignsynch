/**
 * A link out of the dashboard opens a new tab — the negative cases for `scripts/leaving-links.ts`
 * (E39).
 *
 * The rule has three halves and each one is a way for a tree to look correct and behave badly:
 *
 *   - the **element** (`unmarkedLeavingLinks`): a literal marketing `href` in the dashboard's own
 *     markup must sit on an element that opens a new tab — `<Link href="/pricing">` in a
 *     dashboard component is the defect, and the pairs below are the two legal spellings
 *     (`target` + `rel` on the element, or the `LeavingLink` component that owns them);
 *   - the **scope** (`dashboardFiles`): which files are the dashboard's is a graph question, and a
 *     shared chrome module is deliberately *not* in it — it renders on the public site too, where
 *     a `target` would change what a marketing page does to its own reader;
 *   - the **mount** (`unmarkedLeavingMounts`): that shared module is instead held to the `leaving`
 *     prop, and the mount that forgets it is the shape the first rule cannot see;
 *   - and the **runtime table** (`runtimeTableDrift`): `lib/marketing-routes.ts` is the half a
 *     component can read at render time, so it is compared to the derived set in both directions.
 *
 * The last section is the tree this ships in: real routes, real files, no finding.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { LEAVING_ROUTES } from "../../lib/marketing-routes";
import {
  dashboardFiles,
  departureSurfaces,
  importedSymbols,
  isMarketingDestination,
  marketingRoutes,
  routePatterns,
  runtimeTableDrift,
  unmarkedLeavingLinks,
  unmarkedLeavingMounts,
} from "../leaving-links";

const ROUTES = ["/", "/help", "/pricing", "/privacy", "/welcome"];

const file = (path: string, source: string) => ({ path, source });

/* ================================================================== *
 * The public route set is derived from the pages, not listed
 * ================================================================== */

describe("marketingRoutes", () => {
  it("reads the route off the page file, group folder and all", () => {
    assert.deepEqual(
      marketingRoutes([
        "app/(marketing)/page.tsx",
        "app/(marketing)/pricing/page.tsx",
        "app/(marketing)/support/articles/[slug]/page.tsx",
      ]),
      ["/", "/pricing", "/support/articles/[slug]"],
    );
  });

  it("ignores everything that is not a marketing page", () => {
    assert.deepEqual(
      marketingRoutes([
        "app/(mainlayout)/dashboard/page.tsx",
        "app/(marketing)/layout.tsx",
        "components/layout/footer.tsx",
      ]),
      [],
    );
  });
});

describe("isMarketingDestination", () => {
  it("is exact for a static route and strips a query or a fragment", () => {
    assert.equal(isMarketingDestination(ROUTES, "/pricing"), true);
    assert.equal(isMarketingDestination(ROUTES, "/pricing?plan=pro"), true);
    assert.equal(isMarketingDestination(ROUTES, "/#templates"), true);
    assert.equal(isMarketingDestination(ROUTES, "/dashboard"), false);
  });

  it("treats a [slug] route as a prefix and nothing else as one", () => {
    const routes = [...ROUTES, "/support/articles/[slug]"];
    assert.equal(isMarketingDestination(routes, "/support/articles/how-to"), true);
    assert.equal(isMarketingDestination(routes, "/support/articles"), false);
    assert.equal(isMarketingDestination(routes, "/pricing/extra"), false);
  });

  it("skips what is not an internal literal — external, protocol-relative, interpolated", () => {
    for (const href of ["https://example.com/pricing", "//cdn.example.com/", "/quiz/${id}"]) {
      assert.equal(isMarketingDestination(ROUTES, href), false, href);
    }
  });
});

/* ================================================================== *
 * The element rule
 * ================================================================== */

const links = (source: string) =>
  unmarkedLeavingLinks({
    files: [file("components/dashboard/x.tsx", source)],
    routes: ROUTES,
  });

describe("unmarkedLeavingLinks", () => {
  it("fails a dashboard Link to a public page — the defect the rule exists for", () => {
    const findings = links(
      'export const A = () => <Link href="/pricing" className="underline">pricing</Link>;',
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.rule, "E39");
    assert.match(findings[0]?.message ?? "", /target="_blank"/);
  });

  it("passes an anchor that carries target and both rel tokens", () => {
    assert.deepEqual(
      links('<a href="/pricing" target="_blank" rel="noopener noreferrer">pricing</a>'),
      [],
    );
  });

  it("fails an anchor with target and only one of the two rel tokens", () => {
    assert.equal(links('<a href="/pricing" target="_blank" rel="noopener">x</a>').length, 1);
    assert.equal(links('<a href="/pricing" target="_blank">x</a>').length, 1);
  });

  it("passes the sanctioned component, which owns the pair", () => {
    assert.deepEqual(links('<LeavingLink href="/pricing" label="pricing" />'), []);
  });

  it("passes an in-app destination — the rule is only about leaving", () => {
    assert.deepEqual(
      links('<Link href="/dashboard/user" className="underline">account</Link>'),
      [],
    );
  });

  it("passes a dynamic href — only literals are the rule's business", () => {
    assert.deepEqual(links('<Link href={item.href} className="underline">row</Link>'), []);
  });

  it("reads a multi-line start tag whole, so the attributes after the href still count", () => {
    assert.deepEqual(
      links(`
        <a
          href="/terms"
          className="underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          terms
        </a>
      `),
      [],
    );
  });
});

/* ================================================================== *
 * The scope, and the mount it hands to the `leaving` prop
 * ================================================================== */

const tree = [
  file("app/(mainlayout)/dashboard/page.tsx", 'import { Row } from "@/components/row";'),
  file("app/(marketing)/pricing/page.tsx", 'import { Band } from "@/components/band";'),
  file(
    "components/row.tsx",
    'import Link from "next/link";\nexport function Row() { return <Link href="/pricing">x</Link>; }',
  ),
  file(
    "components/band.tsx",
    'import Link from "next/link";\nexport function Band() { return <Link href="/pricing">x</Link>; }',
  ),
  file(
    "components/shared.tsx",
    [
      'import Link from "next/link";',
      "export function Shared({ leaving }: { leaving: boolean }) {",
      '  return <Link href="/pricing">x</Link>;',
      "}",
      "export function PublicOnly() {",
      '  return <Link href="/help">x</Link>;',
      "}",
    ].join("\n"),
  ),
];

describe("dashboardFiles", () => {
  it("keeps the dashboard's own modules and drops the ones a public tree renders too", () => {
    const paths = dashboardFiles([
      ...tree,
      file(
        "components/shared.tsx",
        'import Link from "next/link";\nexport function Shared() { return <i/>; }',
      ),
    ]).map((entry) => entry.path);
    assert.deepEqual(paths, ["app/(mainlayout)/dashboard/page.tsx", "components/row.tsx"]);
  });
});

describe("departureSurfaces", () => {
  it("names a component both trees mount, and not one only the dashboard mounts", () => {
    const surfaces = departureSurfaces({
      files: [
        ...tree,
        file("app/(marketing)/help/page.tsx", 'import { Shared } from "@/components/shared";'),
        file("app/(mainlayout)/x/page.tsx", 'import { Shared } from "@/components/shared";'),
      ],
      routes: ROUTES,
    });
    assert.deepEqual(surfaces, [{ module: "components/shared.tsx", symbol: "Shared" }]);
  });

  it("attributes a link to the exported component that renders the helper which spells it", () => {
    const surfaces = departureSurfaces({
      files: [
        file("app/(marketing)/page.tsx", 'import { Shared } from "@/components/shared";'),
        file("app/(mainlayout)/x/page.tsx", 'import { Shared } from "@/components/shared";'),
        file(
          "components/shared.tsx",
          [
            "export function Shared() {",
            "  return <Row />;",
            "}",
            "function Row() {",
            '  return <a href="/pricing">x</a>;',
            "}",
          ].join("\n"),
        ),
      ],
      routes: ROUTES,
    });
    assert.deepEqual(surfaces, [{ module: "components/shared.tsx", symbol: "Shared" }]);
  });
});

describe("unmarkedLeavingMounts", () => {
  const surfaces = [{ module: "components/layout/footer.tsx", symbol: "Footer" }];
  const footer = file(
    "components/layout/footer.tsx",
    'export function Footer({ leaving }: { leaving?: boolean }) { return <a href="/pricing">x</a>; }',
  );

  it("fails a dashboard mount that forgot the prop", () => {
    const findings = unmarkedLeavingMounts({
      files: [
        footer,
        file(
          "app/(mainlayout)/tournaments/[id]/page.tsx",
          'import { Footer } from "@/components/layout/footer";\nexport default () => <Footer copy={c} />;',
        ),
      ],
      surfaces,
      sources: [footer],
    });
    assert.equal(findings.length, 1);
    assert.match(findings[0]?.message ?? "", /must pass `leaving`/);
  });

  it("passes the mount that carries it", () => {
    assert.deepEqual(
      unmarkedLeavingMounts({
        files: [
          footer,
          file(
            "app/(mainlayout)/tournaments/[id]/page.tsx",
            'import { Footer } from "@/components/layout/footer";\nexport default () => <Footer copy={c} leaving />;',
          ),
        ],
        surfaces,
        sources: [footer],
      }),
      [],
    );
  });

  it("says nothing about a file that does not import the surface", () => {
    assert.deepEqual(
      unmarkedLeavingMounts({
        files: [file("app/(mainlayout)/x/page.tsx", "export default () => <main />;")],
        surfaces,
        sources: [footer],
      }),
      [],
    );
  });
});

describe("importedSymbols", () => {
  it("reads named imports and resolves the alias", () => {
    const known = new Set(["components/layout/footer.tsx"]);
    assert.deepEqual(
      importedSymbols(
        file(
          "app/x/page.tsx",
          'import { Footer, Other as Renamed } from "@/components/layout/footer";',
        ),
        "components/layout/footer.tsx",
        known,
      ),
      ["Footer", "Other"],
    );
  });
});

/* ================================================================== *
 * The runtime table is the check's other half
 * ================================================================== */

describe("runtimeTableDrift", () => {
  it("passes when the table is the derived set", () => {
    assert.deepEqual(
      runtimeTableDrift({
        routes: ["/", "/pricing", "/support/articles/[slug]"],
        table: ["/", "/pricing", "/support/articles/*"],
      }),
      [],
    );
  });

  it("fails a shipping page the runtime table does not name", () => {
    const findings = runtimeTableDrift({ routes: ["/", "/help"], table: ["/"] });
    assert.equal(findings.length, 1);
    assert.match(findings[0]?.message ?? "", /missing \/help/);
  });

  it("fails a table row with no page behind it", () => {
    const findings = runtimeTableDrift({ routes: ["/"], table: ["/", "/welcome"] });
    assert.match(findings[0]?.message ?? "", /no page for \/welcome/);
  });
});

describe("routePatterns", () => {
  it("spells a [slug] route as a prefix", () => {
    assert.deepEqual(routePatterns(["/", "/support/articles/[slug]"]), [
      "/",
      "/support/articles/*",
    ]);
  });

  it("widens a page nested under a dynamic segment to the same prefix, once", () => {
    // `/relationship-types/[slug]/demo` is a marketing page one level below a dynamic one. It has
    // to reach the table, and it can only reach it as the prefix its parent already owns: a
    // literal row would name a URL no reader can be at.
    assert.deepEqual(
      routePatterns(["/", "/relationship-types/[slug]", "/relationship-types/[slug]/demo"]),
      ["/", "/relationship-types/*"],
    );
  });
});

/* ================================================================== *
 * The real tree
 * ================================================================== */

const ROOTS = ["app", "components"];

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, files);
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    files.push(full.slice(process.cwd().length + 1));
  }
  return files;
}

const realSources = ROOTS.flatMap((root) => {
  const dir = join(process.cwd(), root);
  return walk(dir).map((path) => ({
    path,
    source: readFileSync(join(process.cwd(), path), "utf8"),
  }));
});

describe("the real tree", () => {
  const routes = marketingRoutes(realSources.map((entry) => entry.path));

  it("derives the public routes from the marketing group", () => {
    assert.deepEqual(routes, [
      "/",
      "/help",
      "/pricing",
      "/privacy",
      // #905 — the catalogue answers at `/relationship-templates`; `/relationship-types` is the
      // retained #889 variation and the namespace the type pages live in (`/templates` is a 308
      // to the catalogue, and the library is `/templates/relationship` inside the app shell).
      "/relationship-templates",
      "/relationship-types",
      "/relationship-types/[slug]",
      // The worked example, one segment below the type it belongs to — a public page, so it has
      // to appear here or `routePatterns` would never widen it into the table.
      "/relationship-types/[slug]/demo",
      "/support/articles/[slug]",
      "/terms",
      "/welcome",
    ]);
  });

  it("has no dashboard link that leaves without a new tab", () => {
    assert.deepEqual(
      unmarkedLeavingLinks({
        files: dashboardFiles(realSources),
        routes,
        surfaces: departureSurfaces({ files: realSources, routes }),
      }),
      [],
    );
  });

  it("has no shared surface mounted in the dashboard without `leaving`", () => {
    assert.deepEqual(
      unmarkedLeavingMounts({
        files: dashboardFiles(realSources),
        surfaces: departureSurfaces({ files: realSources, routes }),
        sources: realSources,
      }),
      [],
    );
  });

  it("has a runtime table that is the derived set", () => {
    assert.deepEqual(runtimeTableDrift({ routes, table: LEAVING_ROUTES }), []);
  });

  it("walked a tree, not an empty list — the census is what makes the clean answer mean something", () => {
    const walked = dashboardFiles(realSources).length;
    assert.ok(walked > 100, `expected the dashboard's whole graph, read ${walked}`);
    assert.ok(routes.length > 1, "expected several public routes");
  });
});
