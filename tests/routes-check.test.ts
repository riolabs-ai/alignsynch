/**
 * The route tree is Next's to judge, and this is the seam that says so (#1113).
 *
 * `next start` refuses to boot a build whose dynamic routes cannot be sorted:
 * `sortDynamicRoutes()` in `next/dist/server/lib/router-utils/filesystem.js` hands
 * `getSortedRoutes()` the manifest's `dynamicRoutes[].page` set, and that function throws when two
 * pages put different dynamic segment names at one level. `next build` cannot see it —
 * `validateAppPaths()` validates within a single route — so a tree with
 * `/dashboard/templates/[id]` beside `/dashboard/templates/[slug]/create` compiled, passed every
 * gate step, and answered 500 on its first request. `scripts/routes-check.mjs` runs that same
 * function over the built manifest; these cases pin the verdict, not a re-implementation of it.
 *
 * The green cases are as load-bearing as the red ones. `/(a)/x/[id]` beside `/(b)/x/[slug]` is
 * legal to Next — the group segment differs — and a hand-rolled "two dynamic names at one depth"
 * walker would call it a conflict and stop every legitimate rename. `/x/[id]` beside
 * `/x/[id]/[slug]` is legal for the same kind of reason. Both are here so that a future rewrite of
 * the check cannot quietly become a walker.
 *
 * Fixtures are path lists, never a committed `routes-manifest.json`: the verdict is a function of
 * the page set, and a built manifest is an artifact of one build on one machine.
 */
import { describe, expect, it } from "vitest";

import { checkRoutes, pagesFromManifest } from "../scripts/routes-check.mjs";

/** The sentence Next prints from the boot path, verbatim — the verdict the gate must carry. */
const DIFFERENT_SLUG_NAMES =
  "You cannot use different slug names for the same dynamic path ('id' !== 'slug').";

/** The failing half of the union, for the cases that must throw — a green verdict here is a bug. */
function conflict(pages: string[]) {
  const verdict = checkRoutes(pages);
  if (verdict.ok) throw new Error(`expected a conflict from ${pages.join(" + ")}`);
  return verdict;
}

describe("checkRoutes", () => {
  it("rejects the pair that cost a boot: [id] beside [slug]/create at one level", () => {
    const verdict = conflict(["/dashboard/templates/[id]", "/dashboard/templates/[slug]/create"]);

    // Verbatim, not paraphrased: this is the sentence `next start` prints.
    expect(verdict.message).toBe(DIFFERENT_SLUG_NAMES);
    // The hint names the level and both routes, for whoever has to go and fix it.
    expect(verdict.hint).toContain("/dashboard/templates");
    expect(verdict.hint).toContain("/dashboard/templates/[id]");
    expect(verdict.hint).toContain("/dashboard/templates/[slug]/create");
  });

  it("rejects the same pair wrapped in a route group", () => {
    const verdict = conflict([
      "/(mainlayout)/dashboard/templates/[id]",
      "/(mainlayout)/dashboard/templates/[slug]/create",
    ]);

    expect(verdict.message).toBe(DIFFERENT_SLUG_NAMES);
  });

  it("accepts different dynamic names in sibling route groups — Next does", () => {
    // The case a hand-rolled segment walker gets wrong: `(a)` and `(b)` are different segments,
    // so these two routes never meet at one level.
    expect(checkRoutes(["/(a)/x/[id]", "/(b)/x/[slug]"])).toEqual({ ok: true });
  });

  it("accepts a nested dynamic segment under the same name", () => {
    expect(checkRoutes(["/x/[id]", "/x/[id]/[slug]"])).toEqual({ ok: true });
  });

  it("rejects a catch-all that is not the last segment", () => {
    expect(conflict(["/x/[...rest]/y"]).message).toBe(
      "Catch-all must be the last part of the URL.",
    );
  });
});

describe("pagesFromManifest", () => {
  it("takes the unique page of every dynamic route, the set Next sorts", () => {
    const manifest = {
      dynamicRoutes: [
        { page: "/a/[id]" },
        { page: "/a/[id]" },
        { page: "/b/[slug]" },
        { page: "/api/auth/[...path]", routeRegex: "ignored" },
      ],
    };

    expect(pagesFromManifest(manifest)).toEqual(["/a/[id]", "/b/[slug]", "/api/auth/[...path]"]);
  });

  it("returns nothing when the manifest carries no dynamicRoutes array", () => {
    expect(pagesFromManifest({ staticRoutes: [] })).toEqual([]);
    expect(pagesFromManifest(null)).toEqual([]);
  });
});
