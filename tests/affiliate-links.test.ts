/**
 * `/affiliate` is advertised only where `commerce.affiliate` says it may be (#291 follow-up).
 *
 * #291 gated the route: `app/(mainlayout)/affiliate/page.tsx` calls `notFound()` while the flag is
 * off, so `/affiliate` answers 404 on both brands. Four places still drew a row to it, which is
 * the same defect `/leaderboard` had before #175 — a shell that hands out a dead link:
 *
 *   1. `components/layout/nav-menus.tsx` — the sidebar's Affiliate row;
 *   2. `components/layout/footer.tsx` — the Quick Links row;
 *   3. `components/layout/header.tsx` — the notification drawer's "Quiz Reward" row, whose `link`
 *      is `/affiliate` (`data/notifications.ts` `notif-3`);
 *   4. `components/dashboard/affiliate-dashboard.tsx` — the affiliate tab's "Learn More About Our
 *      Affiliate Program" CTA.
 *
 * One rule, four consumers: the flag is resolved **on the server** and the answer travels as a
 * list (`navSurfaces` -> `hiddenNavHrefs()` -> the `hiddenNav` prop), because `lib/flags.ts`
 * throws in a browser and three of the four sites are client components. So this file proves,
 * for each site and in both directions:
 *
 *   - flag off — the link is absent from the markup;
 *   - flag on — the link is back, in the position it has always held. That half matters: the
 *     fixtures are deliberately untouched (`data/pages/shell.ts` still declares both labels), so
 *     "gone" has to be the flag's doing and not a deleted row.
 *
 * The dashboard CTA takes `hiddenNav` as a **required** prop with no default, the same shape
 * `Footer` uses, so the compiler names any future mount that forgets it.
 *
 * "Renders" means `renderToStaticMarkup` with `next/link` mocked to an anchor — the harness
 * `tests/nav-brand.test.ts` and `tests/leaderboard-links.test.ts` already use.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}));

/** A closed Radix menu renders no rows; these two are open in the header's markup. */
vi.mock("@/components/ui/dropdown-menu", () => {
  const Box = ({ children }: { children?: ReactNode }) => createElement("div", null, children);
  return {
    DropdownMenu: Box,
    DropdownMenuContent: Box,
    DropdownMenuItem: Box,
    DropdownMenuSeparator: () => createElement("hr"),
    DropdownMenuTrigger: Box,
  };
});

import { AffiliateDashboard } from "@/components/dashboard/affiliate-dashboard";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { AppNav } from "@/components/layout/nav-menus";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { shellPageCopy } from "@/data/pages/shell";
import { searchIndexFor } from "@/data/searchdata";
import { hiddenNavHrefs } from "@/lib/flags";
import { PLATFORM_VIEWER } from "@/lib/nav";

afterEach(() => {
  vi.unstubAllEnvs();
});

/**
 * The quiz template, stated rather than inherited — the same rule `tests/leaderboard-links.test.ts`
 * carries (#300). Two reasons here: `hiddenNavHrefs()` reads the template, and the header's
 * notification rows are the *quiz* brand's, so on `BRAND=alignsynch` every row whose link is a quiz
 * surface is filtered out (correctly — those routes answer 404 there) and the drawer's "keeps the
 * other rows" assertion would be reading a different screen. The affiliate gate itself is one flag
 * and is flipped inside each case.
 */
beforeEach(() => {
  vi.stubEnv("BRAND", "quizhub");
});

/** Every `href` in a rendered tree, in document order. */
function hrefsOf(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
}

/**
 * The notification row the drawer draws for `/affiliate`. Its words, not its `href`: the drawer
 * renders each row as a `div` whose click handler navigates, so the absence that has to be proven
 * is the row itself.
 */
const AFFILIATE_NOTIFICATION = [
  "Quiz Reward",
  "You've earned $5.25 from your 'History Trivia' quiz",
];

/** The four sites, one render each, given the list the shell resolved. */
const SITES: readonly { site: string; html: (hiddenNav: readonly string[]) => string }[] = [
  {
    site: "the sidebar",
    html: (hiddenNav) =>
      renderToStaticMarkup(
        createElement(AppNav, {
          brandId: "quizhub",
          viewer: PLATFORM_VIEWER,
          copy: shellPageCopy,
          collapsed: false,
          pathname: "/",
          onNavigate: () => undefined,
          hidden: hiddenNav,
        }),
      ),
  },
  {
    site: "the footer",
    html: (hiddenNav) =>
      renderToStaticMarkup(
        createElement(Footer, { copy: shellPageCopy, hiddenNav, brandId: "quizhub" }),
      ),
  },
  {
    site: "the notification drawer",
    html: (hiddenNav) =>
      renderToStaticMarkup(
        createElement(SidebarProvider, null, [
          createElement(Header, {
            key: "header",
            copy: shellPageCopy,
            brandId: "quizhub",
            viewer: PLATFORM_VIEWER,
            account: null,
            searchIndex: searchIndexFor("quizhub", PLATFORM_VIEWER),
            hiddenNav,
          }),
        ]),
      ),
  },
  {
    site: "the dashboard affiliate CTA",
    html: (hiddenNav) => renderToStaticMarkup(createElement(AffiliateDashboard, { hiddenNav })),
  },
];

/** Does this site's markup carry the dead link — by href, or (the drawer) by its own copy? */
function advertises(html: string): boolean {
  return (
    hrefsOf(html).includes("/affiliate") ||
    AFFILIATE_NOTIFICATION.some((phrase) => html.includes(phrase))
  );
}

describe("with commerce.affiliate off", () => {
  it("names the surface, so every consumer can drop it", () => {
    vi.stubEnv("FLAG_COMMERCE_AFFILIATE", undefined);

    const hiddenNav = hiddenNavHrefs();
    expect(hiddenNav).toContain("/affiliate");

    for (const { site, html } of SITES) {
      expect(advertises(html(hiddenNav)), site).toBe(false);
    }
  });

  it("is the default: an unset variable hides it exactly as 0 does", () => {
    for (const value of [undefined, "0"]) {
      vi.stubEnv("FLAG_COMMERCE_AFFILIATE", value);
      for (const { site, html } of SITES) {
        expect(advertises(html(hiddenNavHrefs())), `${site} (FLAG=${String(value)})`).toBe(false);
      }
    }
  });

  it("keeps every other row: the flag removes one destination, not the column", () => {
    vi.stubEnv("FLAG_COMMERCE_AFFILIATE", "0");

    const html = SITES[1].html(hiddenNavHrefs());
    expect(hrefsOf(html)).toEqual(expect.arrayContaining(["/pricing", "/create/editor"]));

    // The drawer loses its reward row and keeps the other five.
    const drawer = SITES[2].html(hiddenNavHrefs());
    expect(drawer).toContain("Achievement Unlocked!");
    expect(drawer).toContain("Tournament Starting Soon");
  });
});

describe("with commerce.affiliate on, all four carry the link again", () => {
  it("the list stops naming the surface and every site draws its row", () => {
    vi.stubEnv("FLAG_COMMERCE_AFFILIATE", "1");

    const hiddenNav = hiddenNavHrefs();
    expect(hiddenNav).not.toContain("/affiliate");

    for (const { site, html } of SITES) {
      expect(advertises(html(hiddenNav)), site).toBe(true);
    }
  });
});

describe("the affiliate asset itself is untouched", () => {
  it("the sidebar's row is one row among the menu's fifteen destinations", () => {
    // The fixtures still declare both labels (`data/pages/shell.ts`), which is what makes
    // "the flag removes it" provable rather than "somebody deleted the row".
    const html = SITES[0].html([]);
    expect(hrefsOf(html).filter((href) => href === "/affiliate")).toHaveLength(1);
    expect(html).toContain("Affiliate");
  });

  it("the footer's Quick Links column still declares the row in the fixture", () => {
    const links = shellPageCopy.sections
      ?.find((section) => section.id === "footer-links")
      ?.items?.map((item) => item.id);
    expect(links).toContain("affiliate");
  });
});
