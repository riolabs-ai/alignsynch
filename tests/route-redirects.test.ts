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

import { matchRoute } from "@/content/route-manifest";
import { ROUTE_PATTERNS, routeManifest } from "@/content/routes";
import nextConfig from "@/next.config.mjs";

/** The list Next actually uses, resolved once — `redirects()` is async and takes no arguments. */
let redirects: readonly { source: string; destination: string }[] = [];

beforeAll(async () => {
  redirects = (await nextConfig.redirects?.()) ?? [];
});

/** A destination with its query string removed: `matchRoute` matches paths, not parameters. */
function pathOf(destination: string): string {
  return destination.split("?")[0] ?? destination;
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
    const dead = redirects.filter(
      (entry) => matchRoute(routeManifest, pathOf(entry.destination)) === undefined,
    );

    expect(dead).toEqual([]);
  });
});
