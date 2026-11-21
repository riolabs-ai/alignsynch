/**
 * nav-inventory tests — the tree reduced to routes, and the four rules that reduce it (#862).
 *
 * The reconciler is only as honest as this walk. Every case here is one of the two ways it can go
 * wrong:
 *
 *   - **a route that is not a route** — a parallel slot (`@flow`), an intercepting route
 *     (`(.)[slug]`) or a dynamic segment (`[id]`) counted as a destination. Each would fail the
 *     build with a finding nobody can act on, which is how a rule gets switched off.
 *   - **a fact read out of a comment** — this tree names `requireQuizProduct()`,
 *     `requireRole("support")` and `requireSpecReader()` in prose all over `app/`, including in the
 *     pages' own doc comments. A scanner reading raw text would give a page a boundary and a floor
 *     it does not have, and a wrong floor in the inventory is a wrong claim about who may see a
 *     door.
 *
 * The reconciliation itself (placed / unlisted / unaccounted, and the three `NAV_SOURCE` modes) is
 * driven from `tests/nav-reconciler.test.ts`, where the document is a value.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SourceFile } from "../ui-refs";
import {
  boundaryOf,
  consoleOf,
  groupOfSourcePath,
  inventoryFrom,
  roleFloorOf,
  routeOfSourcePath,
} from "../nav-inventory";

const file = (
  path: string,
  source = "export default function Page() { return null; }",
): SourceFile => ({
  path,
  source,
});

describe("routeOfSourcePath", () => {
  it("strips the route group, which a URL does not carry", () => {
    assert.equal(routeOfSourcePath("app/(mainlayout)/admin/console/page.tsx"), "/admin/console");
    assert.equal(routeOfSourcePath("app/(marketing)/page.tsx"), "/");
  });

  it("serves no route for a slot, an intercepting route or a dynamic segment", () => {
    // A parallel slot renders beside its page; `@flow` is not an address.
    assert.equal(routeOfSourcePath("app/(mainlayout)/assessment/@flow/(.)x/create/page.tsx"), null);
    // An intercepting route serves the parent's address — a row for it would be a second row.
    assert.equal(
      routeOfSourcePath("app/(mainlayout)/dashboard/templates/@flow/(.)[slug]/create/page.tsx"),
      null,
    );
    // A family of addresses is reached from the list that draws it, never from a rail row.
    assert.equal(routeOfSourcePath("app/(mainlayout)/dashboard/relationships/[id]/page.tsx"), null);
    assert.equal(routeOfSourcePath("app/(mainlayout)/admin/docs/[...slug]/page.tsx"), null);
  });

  it("ignores every file that is not a page", () => {
    assert.equal(routeOfSourcePath("app/(mainlayout)/admin/layout.tsx"), null);
    assert.equal(routeOfSourcePath("components/layout/nav-menus.tsx"), null);
  });
});

describe("groupOfSourcePath", () => {
  it("reads the route group, which is what the shell boundary is made of", () => {
    assert.equal(groupOfSourcePath("app/(mainlayout)/settings/page.tsx"), "(mainlayout)");
    assert.equal(groupOfSourcePath("app/(marketing)/pricing/page.tsx"), "(marketing)");
    assert.equal(groupOfSourcePath("app/(auth)/login/page.tsx"), "(auth)");
    // A page outside every group is in no shell.
    assert.equal(groupOfSourcePath("app/health/page.tsx"), null);
  });
});

describe("boundaryOf", () => {
  it("reads the brand gate, and a page with none is `any`", () => {
    assert.equal(boundaryOf("export default function P() { requireQuizProduct(); }"), "quiz");
    assert.equal(
      boundaryOf("export default function P() { requireAlignmentProduct(); }"),
      "alignment",
    );
    assert.equal(boundaryOf("export default function P() { return null; }"), "any");
  });

  it("does not read a gate named in a comment — the tree explains these helpers everywhere", () => {
    const source = [
      "/**",
      " * Gated by `requireQuizProduct()` on the quiz build; see `requireAlignmentProduct()`.",
      " */",
      "export default function P() { requireAlignmentProduct(); }",
    ].join("\n");
    assert.equal(boundaryOf(source), "alignment");
  });

  it("keeps the console capability apart from the brand — `/admin/brand` is both", () => {
    const source =
      "export default function P() { requireAdminProduct(); requireAlignmentProduct(); }";
    assert.equal(consoleOf(source), true);
    assert.equal(boundaryOf(source), "alignment");
    // …and a console page with no brand gate is `any`, which is every other `/admin` page.
    assert.equal(boundaryOf("requireAdminProduct();"), "any");
  });
});

describe("roleFloorOf", () => {
  it("reads the rung a page names, and the spec gate as its own value", () => {
    assert.equal(roleFloorOf('requireRole("support", { next: "/admin/inbox" })'), "support");
    assert.equal(roleFloorOf('requireRole("member")'), "member");
    assert.equal(roleFloorOf('await requireAdmin({ next: "/admin/audit" })'), "admin");
    // The spec gate refuses `support`, which the admin rung would admit — a rung cannot say it.
    assert.equal(roleFloorOf('requireSpecReader({ next: "/admin/spec" })'), "spec-reader");
  });

  it("does not mistake the console capability for the admin rung", () => {
    assert.equal(roleFloorOf("requireAdminProduct();"), null);
  });

  it("says `null` for a page whose gate is in its layout, and for one with no gate at all", () => {
    assert.equal(roleFloorOf("export default function P() { return null; }"), null);
    assert.equal(roleFloorOf("// requireAdmin() lives in the layout\n"), null);
  });
});

describe("inventoryFrom", () => {
  const sources = [
    file("app/(mainlayout)/admin/console/page.tsx", "requireAdminProduct();"),
    file("app/(mainlayout)/settings/page.tsx", 'requireRole("member");'),
    file("app/(mainlayout)/battle/page.tsx", "requireQuizProduct();"),
    file("app/(mainlayout)/assessment/@flow/x/page.tsx"),
    file("app/(marketing)/pricing/page.tsx"),
    file("app/(mainlayout)/admin/layout.tsx"),
  ];

  it("counts what it walked and returns the routes in address order", () => {
    const inventory = inventoryFrom(sources);
    // Two pages were walked and dropped to no route: the slot and the layout is not a page at all.
    assert.equal(inventory.walked, 5);
    assert.deepEqual(
      inventory.surfaces.map((surface) => surface.href),
      ["/admin/console", "/battle", "/pricing", "/settings"],
    );
  });

  it("carries the two facts and the file every finding points at", () => {
    const console = inventoryFrom(sources).surfaces.find(
      (surface) => surface.href === "/admin/console",
    );
    assert.deepEqual(console, {
      href: "/admin/console",
      file: "app/(mainlayout)/admin/console/page.tsx",
      group: "(mainlayout)",
      boundary: "any",
      console: true,
      roleFloor: null,
    });
  });
});
