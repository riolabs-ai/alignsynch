/**
 * The post-sign-in destination, per brand (issue #351).
 *
 * Four things are pinned here, and each one is a way the same defect came back:
 *
 *   1. **the table is exhaustive** — every `BrandId` names a destination, so a third brand cannot
 *      inherit QuizHub's account home the way AlignSynch did;
 *   2. **`safeNextPath` takes the brand's fallback** — the default parameter is what keeps every
 *      caller written before this card byte-identical;
 *   3. **a `?next=` naming a surface this build does not ship falls back** — `/login?next=/explore`
 *      on the alignment build used to return the visitor to a route that answers 404 *before* it
 *      resolves the session, so the Neon verifier was never exchanged and a person who had just
 *      signed in was signed out;
 *   4. **the callback URL is a URL** — `absoluteUrlFor` round-trips a query, a fragment and a
 *      percent-encoded value, and the verifier Neon appends lands in the *query*, never the path.
 *
 * `signInDestination` reads `lib/flags.ts`, which resolves the template from `process.env.BRAND`,
 * so the brand cases stub it with `vi.stubEnv` and restore it in `afterEach` — the same mechanism
 * `tests/flags.test.ts` uses.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** `next/link` renders an anchor here, exactly as `tests/leaderboard-links.test.ts` mocks it. */
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

import NotFound from "@/app/not-found";
import { brand, brandIdOf, brands } from "@/data/brand";
import { notFoundPageCopy } from "@/data/pages/not-found";
import {
  namesHiddenSurface,
  pathnameOf,
  signInDestination,
  staticPrefixOf,
} from "@/lib/auth/next-path";
import {
  AFTER_SIGN_IN,
  AFTER_SIGN_IN_BY_BRAND,
  absoluteUrlFor,
  loginPathFor,
  safeNextPath,
} from "@/lib/auth/paths";
import { OVERVIEW_PATH } from "@/lib/flow/paths";
import { notFoundCopyFor } from "@/lib/not-found-copy";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AFTER_SIGN_IN_BY_BRAND", () => {
  it("names a destination for every brand — a new brand is a tsc error, not an inherited dead end", () => {
    expect(Object.keys(AFTER_SIGN_IN_BY_BRAND).sort()).toEqual(Object.keys(brands).sort());
  });

  it("keeps QuizHub on its account home", () => {
    expect(AFTER_SIGN_IN_BY_BRAND.quizhub).toBe("/dashboard/user");
    expect(AFTER_SIGN_IN_BY_BRAND.quizhub).toBe(AFTER_SIGN_IN);
  });

  it("lands AlignSynch on the console Overview, from the one constant that owns that path", () => {
    expect(AFTER_SIGN_IN_BY_BRAND.alignsynch).toBe("/dashboard");
    expect(AFTER_SIGN_IN_BY_BRAND.alignsynch).toBe(OVERVIEW_PATH);
  });

  it("every destination is a same-site path", () => {
    for (const [brand, path] of Object.entries(AFTER_SIGN_IN_BY_BRAND)) {
      expect(path.startsWith("/"), brand).toBe(true);
      expect(path.startsWith("//"), brand).toBe(false);
    }
  });
});

describe("safeNextPath with a brand fallback", () => {
  const alignsynch = AFTER_SIGN_IN_BY_BRAND.alignsynch;

  it("keeps a same-site path", () => {
    expect(safeNextPath("/settings", alignsynch)).toBe("/settings");
    expect(safeNextPath("/dashboard", alignsynch)).toBe("/dashboard");
  });

  it("replaces anything that is not a path on this site with the brand's destination", () => {
    expect(safeNextPath("", alignsynch)).toBe("/dashboard");
    expect(safeNextPath(undefined, alignsynch)).toBe("/dashboard");
    expect(safeNextPath(null, alignsynch)).toBe("/dashboard");
    expect(safeNextPath("//evil.example/x", alignsynch)).toBe("/dashboard");
    expect(safeNextPath("https://evil.example", alignsynch)).toBe("/dashboard");
    expect(safeNextPath("javascript:alert(1)", alignsynch)).toBe("/dashboard");
  });

  it("defaults to QuizHub's account home when no fallback is given — every pre-#351 caller", () => {
    for (const junk of ["", undefined, null, "//evil.example/x", "https://evil.example"]) {
      expect(safeNextPath(junk)).toBe(AFTER_SIGN_IN);
    }
  });
});

describe("signInDestination — the same-site gate, then the exists-on-this-build gate", () => {
  it("sends a request for a surface the alignment build does not ship to /dashboard", () => {
    vi.stubEnv("BRAND", "alignsynch");
    for (const requested of [
      "/dashboard/user",
      "/dashboard/user?tab=wallet",
      "/explore",
      "/explore/featured",
      "/quiz/abc",
      "/categories/negotiation",
      "/my-quizzes/xyz",
      "/leaderboard",
    ]) {
      expect(signInDestination(requested, "/dashboard"), requested).toBe("/dashboard");
    }
  });

  it("returns a path the alignment build does ship unchanged, query included", () => {
    vi.stubEnv("BRAND", "alignsynch");
    expect(signInDestination("/settings", "/dashboard")).toBe("/settings");
    expect(signInDestination("/settings?tab=account", "/dashboard")).toBe("/settings?tab=account");
    expect(signInDestination("/dashboard", "/dashboard")).toBe("/dashboard");
    expect(signInDestination("/assessment/instances", "/dashboard")).toBe("/assessment/instances");
    expect(signInDestination("/some/unknown/path", "/dashboard")).toBe("/some/unknown/path");
  });

  it("falls back for a missing or unsafe value", () => {
    vi.stubEnv("BRAND", "alignsynch");
    expect(signInDestination(undefined, "/dashboard")).toBe("/dashboard");
    expect(signInDestination("", "/dashboard")).toBe("/dashboard");
    expect(signInDestination("//evil.example/x", "/dashboard")).toBe("/dashboard");
    expect(signInDestination("https://evil.example", "/dashboard")).toBe("/dashboard");
  });

  it("on QuizHub honours a next that names a quiz surface, query and all", () => {
    vi.stubEnv("BRAND", "quizhub");
    expect(signInDestination("/explore", "/dashboard/user")).toBe("/explore");
    expect(signInDestination("/quiz/abc?tab=comments", "/dashboard/user")).toBe(
      "/quiz/abc?tab=comments",
    );
    expect(signInDestination("/dashboard/user?tab=wallet", "/dashboard/user")).toBe(
      "/dashboard/user?tab=wallet",
    );
    expect(signInDestination("/settings", "/dashboard/user")).toBe("/settings");
  });

  it("on QuizHub still refuses a gated surface and any junk", () => {
    vi.stubEnv("BRAND", "quizhub");
    // `/leaderboard` is off on both brands, so it 404s on both — the fallback is the brand's own page.
    expect(signInDestination("/leaderboard", "/dashboard/user")).toBe("/dashboard/user");
    expect(signInDestination("https://evil.example", "/dashboard/user")).toBe("/dashboard/user");
  });

  it("keeps loginPathFor's round-trip unchanged", () => {
    const path = loginPathFor("/profile/ada");
    const encoded = path.slice("?next=".length + "/login".length);
    expect(safeNextPath(decodeURIComponent(encoded))).toBe("/profile/ada");
  });
});

describe("the path guards the fallback is built on", () => {
  it("strips the query and the fragment, and nothing else", () => {
    expect(pathnameOf("/dashboard/user?tab=wallet")).toBe("/dashboard/user");
    expect(pathnameOf("/dashboard/user#top")).toBe("/dashboard/user");
    expect(pathnameOf("/dashboard/user?tab=wallet#top")).toBe("/dashboard/user");
    expect(pathnameOf("/dashboard/user")).toBe("/dashboard/user");
  });

  it("takes the static part of a route pattern, slash included", () => {
    expect(staticPrefixOf("/quiz/[id]")).toBe("/quiz/");
    expect(staticPrefixOf("/categories/[slug]")).toBe("/categories/");
    expect(staticPrefixOf("/dashboard/user")).toBeNull();
  });

  it("matches a concrete href by equality or by that prefix, and never a longer sibling", () => {
    const hidden = ["/explore", "/quiz/[id]", "/my-quizzes/[id]"];
    expect(namesHiddenSurface("/explore", hidden)).toBe(true);
    expect(namesHiddenSurface("/quiz", hidden)).toBe(false);
    expect(namesHiddenSurface("/quiz/abc", hidden)).toBe(true);
    expect(namesHiddenSurface("/my-quizzes/abc/statistics", hidden)).toBe(true);
    // A shared prefix is not a match: the slash in the pattern is what stops it.
    expect(namesHiddenSurface("/my-quizzes-archive", hidden)).toBe(false);
    expect(namesHiddenSurface("/settings", hidden)).toBe(false);
  });
});

describe("absoluteUrlFor — the callback URL is built by URL, not by concatenation", () => {
  const origin = "https://alignsynch.com";

  it("resolves a path against this origin", () => {
    expect(absoluteUrlFor(origin, "/dashboard")).toBe("https://alignsynch.com/dashboard");
    expect(absoluteUrlFor("http://localhost:3000", "/dashboard")).toBe(
      "http://localhost:3000/dashboard",
    );
  });

  it("keeps a query string the path already carries", () => {
    expect(absoluteUrlFor(origin, "/settings?tab=wallet")).toBe(
      "https://alignsynch.com/settings?tab=wallet",
    );
  });

  it("keeps a fragment", () => {
    expect(absoluteUrlFor(origin, "/dashboard#relationships")).toBe(
      "https://alignsynch.com/dashboard#relationships",
    );
  });

  it("keeps a percent-encoded value byte for byte", () => {
    expect(absoluteUrlFor(origin, "/login?next=%2Fdashboard%2Fuser")).toBe(
      "https://alignsynch.com/login?next=%2Fdashboard%2Fuser",
    );
  });

  it("keeps a query and a fragment together", () => {
    const url = absoluteUrlFor(origin, "/assessment/instances?filter=awaiting#top");
    expect(url).toBe("https://alignsynch.com/assessment/instances?filter=awaiting#top");
  });

  it("refuses a value that names another origin", () => {
    expect(absoluteUrlFor(origin, "//evil.example/x")).toBe("https://alignsynch.com/");
    expect(absoluteUrlFor(origin, "https://evil.example/x")).toBe("https://alignsynch.com/");
  });

  /**
   * The defect rio measured: Neon appends `neon_auth_session_verifier` to the callback URL. On a URL
   * that is *already* a query-bearing URL the parameter joins the query; on a callback URL built by
   * gluing strings it can land in the path (`/dashboard/user/neon_auth_session_verifier-…`), which
   * 404s. This is the return URL a real sign-in produces, asserted on its parts.
   */
  it("keeps the verifier in the query, never in the path", () => {
    const callback = new URL(absoluteUrlFor(origin, "/dashboard"));
    callback.searchParams.set("neon_auth_session_verifier", "Pd3hwRV6wkcSPl");

    expect(callback.pathname).toBe("/dashboard");
    expect(callback.searchParams.get("neon_auth_session_verifier")).toBe("Pd3hwRV6wkcSPl");
    expect(callback.toString()).toBe(
      "https://alignsynch.com/dashboard?neon_auth_session_verifier=Pd3hwRV6wkcSPl",
    );
  });

  it("adds the verifier beside a query the destination already had", () => {
    const callback = new URL(absoluteUrlFor(origin, "/settings?tab=account"));
    callback.searchParams.set("neon_auth_session_verifier", "abc123");

    expect(callback.pathname).toBe("/settings");
    expect(callback.searchParams.get("tab")).toBe("account");
    expect(callback.searchParams.get("neon_auth_session_verifier")).toBe("abc123");
  });
});

describe("notFoundCopyFor — the 404 speaks the brand's language", () => {
  const strings = (copy: ReturnType<typeof notFoundCopyFor>): string[] =>
    JSON.stringify(copy).match(/"[^"]*"/g) ?? [];

  it("gives AlignSynch a 404 with no quiz vocabulary at all", () => {
    const copy = notFoundCopyFor(notFoundPageCopy, "alignsynch");
    expect(strings(copy).filter((value) => /quiz/i.test(value))).toEqual([]);
    expect(copy.heading).not.toBe(notFoundPageCopy.heading);
    for (const id of ["message", "fact", "actions"]) {
      expect(
        copy.sections?.some((section) => section.id === id),
        id,
      ).toBe(true);
    }
  });

  it("leaves QuizHub's 404 byte for byte what shipped", () => {
    const copy = notFoundCopyFor(notFoundPageCopy, "quizhub");
    expect(copy.heading).toBe(notFoundPageCopy.heading);
    expect(copy.sections?.map((section) => section.id)).toEqual(["message", "fact", "actions"]);
    expect(copy.sections?.[0]).toStrictEqual(notFoundPageCopy.sections?.[0]);
  });

  /**
   * The page must render the *projection*, not the fixture — the defect this catches is a
   * half-applied change: every section was switched to `copy` and the `<h2>` kept reading
   * `notFoundPageCopy.heading`, so the alignment build printed "Oops! Quiz Not Found" above
   * correctly-keyed sections. A unit test of the projection cannot see that; only the rendered
   * page can. On QuizHub the two headings are the same string by design, so the alignment-only
   * assertions below are the ones that carry the guard — that is the leg that broke.
   */
  it("renders the projection's words, and no quiz vocabulary on the alignment build", () => {
    const copy = notFoundCopyFor(notFoundPageCopy, brandIdOf(brand));
    const html = renderToStaticMarkup(createElement(NotFound));
    const text = html
      .replace(/<[^>]+>/g, " ")
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ");

    expect(text).toContain(copy.heading);

    if (brandIdOf(brand) === "alignsynch") {
      expect(text).not.toMatch(/quiz/i);
      expect(text).not.toContain(notFoundPageCopy.heading);
      // The suggestion band is not drawn at all: all three of its rows are surfaces this build
      // does not ship, and a prompt with no answers under it reads as a broken page.
      expect(html).not.toContain("/explore");
      expect(html).not.toContain('id="browse"');
    }
  });
});
