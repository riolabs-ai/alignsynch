/**
 * `/leaderboard` is advertised only where the flag says it may be (#175 follow-up).
 *
 * #175 made the **sidebar** flag-aware: the layout resolves `hiddenNavHrefs()` and the nav row
 * with `hidden="/leaderboard"` draws nothing. Four other links to the same route were never
 * wired, so a default build offered a member a surface that answers 404:
 *
 *   1. `components/layout/footer.tsx` — the Quick Links row, on every page that mounts a footer;
 *   2. `components/profile/user-profile.tsx` — "← Back to Leaderboard" on a demo profile;
 *   3. `data/pages/home.ts` — the `top-players` band's "View Full Leaderboard" CTA;
 *   4. `app/not-found.tsx` — the 404 body's own third action (a 404 handing out a second 404).
 *
 * The fix is one rule with four consumers: the flag is resolved **on the server** and the answer
 * travels as a list (`hiddenNav`), because `lib/flags.ts` throws in a browser and two of the four
 * sites are client components. So this file proves three things, in that order:
 *
 *   - **both directions per site** — flag off, none of the four renders the href; flag on, all four
 *     do, in the shipped order. The fixtures keep their rows on purpose (`data/pages/home.ts` still
 *     says "View Full Leaderboard"), so the "back where it was" half is provable at all;
 *   - **the bypass does not advertise** — #184's admin bypass answers the *route* for an admin
 *     while the flag is off, and `hiddenNavHrefs()` takes no role, so an admin session gets the
 *     same four-link-free page a member does. Reachable is not advertised;
 *   - **no mount can forget** — `Footer`'s `hiddenNav` is required with no default, and this file
 *     scans `app/` and `components/` for a `<Footer` mount that omits it, because the compiler only
 *     sees the mounts that are typed against the component, not a new one written tomorrow.
 *
 * "Renders" means `renderToStaticMarkup` with `next/link` mocked to an anchor — the same harness
 * `tests/nav-brand.test.ts` uses for the sidebar and the footer's columns.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

import NotFound from "@/app/not-found";
import { TopPlayersCarousel } from "@/components/home/top-players-carousel";
import { Footer } from "@/components/layout/footer";
import { UserProfile } from "@/components/profile/user-profile";
import { homePageCopy } from "@/data/pages/home";
import { shellPageCopy } from "@/data/pages/shell";
import { hiddenNavHrefs, isEnabled } from "@/lib/flags";
import { sectionOf, withoutHiddenCta } from "@/lib/page-copy";
import { profileByHandle } from "@/lib/profile";

/**
 * The quiz template, stated rather than inherited (#300). This file is about the four sites that
 * advertise `community.leaderboard`, so it must assert the same four rows on both matrix legs. The
 * brand boundary hides twenty more hrefs (the quiz product's) on `BRAND=alignsynch`, and a suite
 * that read the ambient template would be asserting the brand boundary's answer under a name that
 * says "leaderboard" — the row would go red in the leg that is not being tested.
 */
beforeEach(() => {
  vi.stubEnv("BRAND", "quizhub");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Every `href` in a rendered tree, in document order. */
function hrefsOf(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
}

/** The demo person `data/players.ts` ranks first — the handle `/profile/<handle>` serves. */
const PROFILE = profileByHandle("alexjohnson");
if (PROFILE === undefined) {
  throw new Error('data/players.ts has no "alexjohnson" — the four-site proof needs one');
}

/**
 * The four sites, as one render each. Give it the list the shell resolved, get the markup back.
 *
 * The 404 ignores its argument **on purpose**: `app/not-found.tsx` is a server module and calls
 * `hiddenNavHrefs()` itself, exactly as the route does, so `process.env` is its input and the
 * stub in each test is what moves it.
 */
const SITES: readonly { site: string; html: (hiddenNav: readonly string[]) => string }[] = [
  {
    // `brandId` is stated, not ambient: this file is about the quiz brand's Quick Links column,
    // and a `BRAND=alignsynch pnpm test` (the matrix leg) must check the same row.
    site: "the footer",
    html: (hiddenNav) =>
      renderToStaticMarkup(
        createElement(Footer, { copy: shellPageCopy, hiddenNav, brandId: "quizhub" }),
      ),
  },
  {
    site: "the demo profile",
    html: (hiddenNav) =>
      renderToStaticMarkup(createElement(UserProfile, { profile: PROFILE, hiddenNav })),
  },
  {
    site: "the home top-players CTA",
    html: (hiddenNav) =>
      renderToStaticMarkup(
        createElement(TopPlayersCarousel, {
          copy: withoutHiddenCta(sectionOf(homePageCopy, "top-players"), hiddenNav),
        }),
      ),
  },
  {
    site: "the 404 body",
    html: () => renderToStaticMarkup(createElement(NotFound)),
  },
];

/** Each site's hrefs for one shell list. */
function renderedSites(hiddenNav: readonly string[]): { site: string; hrefs: string[] }[] {
  return SITES.map(({ site, html }) => ({ site, hrefs: hrefsOf(html(hiddenNav)) }));
}

/** The Quiz Links column, in the order the footer has always drawn it. */
const QUICK_LINKS = ["/dashboard/user", "/create/editor", "/leaderboard", "/affiliate", "/pricing"];

/** The 404's suggestion links, in the order the fixture declares them. */
const NOT_FOUND_ACTIONS = ["/explore", "/categories", "/leaderboard"];

const quickLinksIn = (hrefs: string[]) => hrefs.filter((href) => QUICK_LINKS.includes(href));
const actionsIn = (hrefs: string[]) => hrefs.filter((href) => NOT_FOUND_ACTIONS.includes(href));

describe("with community.leaderboard off, none of the four sites draws /leaderboard", () => {
  it("the shell's list names the surface, and every site drops its link", () => {
    vi.stubEnv("FLAG_COMMUNITY_LEADERBOARD", "0");

    const hiddenNav = hiddenNavHrefs();
    expect(hiddenNav).toEqual(["/leaderboard"]);

    for (const { site, hrefs } of renderedSites(hiddenNav)) {
      expect(hrefs, site).not.toContain("/leaderboard");
    }
  });

  it("keeps every other row the fixture declares, in the order it declares it", () => {
    vi.stubEnv("FLAG_COMMUNITY_LEADERBOARD", "0");

    const [footer, , , notFound] = renderedSites(hiddenNavHrefs());

    // The footer loses one row, not the column: the two above it and the two below stay put.
    expect(quickLinksIn(footer.hrefs)).toEqual([
      "/dashboard/user",
      "/create/editor",
      "/affiliate",
      "/pricing",
    ]);
    // The 404 keeps its other two actions and gains no fourth.
    expect(actionsIn(notFound.hrefs)).toEqual(["/explore", "/categories"]);
  });

  it("is the default: an unset variable hides the surface exactly as 0 does", () => {
    vi.stubEnv("FLAG_COMMUNITY_LEADERBOARD", undefined);

    expect(hiddenNavHrefs()).toEqual(["/leaderboard"]);
    for (const { site, hrefs } of renderedSites(hiddenNavHrefs())) {
      expect(hrefs, site).not.toContain("/leaderboard");
    }
  });
});

describe("with community.leaderboard on, all four carry the link again", () => {
  it("the list is empty and every site draws its row", () => {
    vi.stubEnv("FLAG_COMMUNITY_LEADERBOARD", "1");

    const hiddenNav = hiddenNavHrefs();
    expect(hiddenNav).toEqual([]);

    for (const { site, hrefs } of renderedSites(hiddenNav)) {
      expect(hrefs, site).toContain("/leaderboard");
    }
  });

  it("draws them in the shipped order — the flag changes presence, not position", () => {
    vi.stubEnv("FLAG_COMMUNITY_LEADERBOARD", "1");

    const [footer, , , notFound] = renderedSites(hiddenNavHrefs());

    expect(quickLinksIn(footer.hrefs)).toEqual(QUICK_LINKS);
    expect(actionsIn(notFound.hrefs)).toEqual(NOT_FOUND_ACTIONS);
  });

  it("keeps the fixture's row for a section whose cta is not gated", () => {
    // Guard the guard: `withoutHiddenCta` must not be dropping ctas it has no business dropping,
    // or "the link is gone" would be true on a build where nothing is flagged off.
    const section = sectionOf(homePageCopy, "top-players");
    expect(withoutHiddenCta(section, [])).toBe(section);
    expect(withoutHiddenCta(section, ["/explore"]).cta).toEqual(section.cta);
    expect(withoutHiddenCta(section, ["/leaderboard"]).cta).toBeUndefined();
  });
});

describe("an admin session does not re-advertise the surface", () => {
  it("answers the route but leaves all four links absent", () => {
    vi.stubEnv("FLAG_COMMUNITY_LEADERBOARD", "0");

    // #184's bypass: the route stays reachable for the person who has to review it…
    expect(isEnabled("community.leaderboard", { role: "admin" })).toBe(true);
    // …while the advertising half takes no role at all, so the list is what it was for a member.
    expect(hiddenNavHrefs()).toEqual(["/leaderboard"]);

    for (const { site, hrefs } of renderedSites(hiddenNavHrefs())) {
      expect(hrefs, site).not.toContain("/leaderboard");
    }
  });
});

/**
 * Every `<Footer …>` tag in a source file. `\b` keeps `<FooterColumnHeading>` and
 * `<FooterLinkRow>` out: those are rows, not mounts, and a mount is what the prop has to reach.
 */
function footerTagsIn(source: string): string[] {
  return [...source.matchAll(/<Footer\b[\s\S]*?\/?>/g)].map((match) => match[0]);
}

/**
 * The mounts that do not pass `hiddenNav`, as `path: <tag>`.
 *
 * Pure over `{ path -> source }` so the negative case below can feed it a mount that forgets the
 * prop: a scanner that cannot fail is not a check.
 */
function mountsWithoutHiddenNav(files: Readonly<Record<string, string>>): string[] {
  return Object.entries(files).flatMap(([path, source]) =>
    footerTagsIn(source)
      .filter((tag) => !/hiddenNav=/.test(tag))
      .map((tag) => `${path}: ${tag.replace(/\s+/g, " ")}`),
  );
}

/** Every `.tsx` under `dir`, relative to the repo root. */
function tsxFilesUnder(dir: string): string[] {
  return readdirSync(join(process.cwd(), dir), { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".tsx"))
    .map((entry) => join(dir, entry));
}

describe("every footer mount passes the list down", () => {
  const tree = [...tsxFilesUnder("app"), ...tsxFilesUnder("components")].reduce<
    Record<string, string>
  >((sources, path) => {
    sources[path] = readFileSync(join(process.cwd(), path), "utf8");
    return sources;
  }, {});

  it("finds the mounts it is meant to check (positive control)", () => {
    const mounts = Object.values(tree).flatMap(footerTagsIn);

    // Five today: the three product routes that still render the shell footer themselves, and the
    // two client shells that forward the prop. The other five the count used to hold left in #317:
    // `/` twice (one mount per brand composition), `/pricing`, `/terms` and `/privacy` are public
    // pages now and live in `app/(marketing)/`, where the group's own footer is the chrome — a
    // public page that mounted this one would carry two footers, and the shell footer's nav is
    // exactly what the boundary removes.
    expect(mounts).toHaveLength(5);
  });

  it("leaves no `<Footer>` mount on the tree without hiddenNav", () => {
    expect(mountsWithoutHiddenNav(tree)).toEqual([]);
  });

  it("would fail a mount that forgets it", () => {
    expect(
      mountsWithoutHiddenNav({
        "app/(mainlayout)/invented/page.tsx": "<Footer copy={shellPageCopy} />",
        "components/invented/page.tsx": "<Footer\n  copy={shellCopy}\n  viewer={viewer}\n/>",
      }),
    ).toEqual([
      "app/(mainlayout)/invented/page.tsx: <Footer copy={shellPageCopy} />",
      "components/invented/page.tsx: <Footer copy={shellCopy} viewer={viewer} />",
    ]);

    // And a wired mount is not reported, so the scan is not simply failing everything.
    expect(
      mountsWithoutHiddenNav({
        "app/(mainlayout)/ok/page.tsx": "<Footer copy={shellPageCopy} hiddenNav={hiddenNav} />",
      }),
    ).toEqual([]);
  });
});
