/**
 * The version badge (issue #269) — one component, and what it is allowed to print.
 *
 * The card's claims that a unit can hold:
 *
 *   1. **one source** — the version is `process.env.APP_VERSION`, which `next.config.mjs` fills from
 *      `package.json`. Nothing in `app/`, `components/` or `lib/` spells a version, so the test
 *      stubs a version that appears nowhere in the tree (`9.9.9`) and reads it back out of the
 *      rendered markup: a literal that had crept into the component would survive the stub;
 *   2. **the exact tag** — `releases/tag/v<version>`, never `/releases/latest`;
 *   3. **a real anchor** — `<a href>`, so it is keyboard reachable without JavaScript and a
 *      middle-click works, rather than an `onClick` on a span;
 *   4. **both brands** — the words come from each surface's fixture, and the alignment build's
 *      shell and login fixtures carry the same three ids, so `BRAND=alignsynch` renders a badge
 *      rather than throwing `PageCopy: no section "version"`.
 *
 * The placements (`/login`, the footer, the sidebar) and the tab order are not unit-testable:
 * they are checked on the built page, and `tests/parity/` hashes the two routes that render the
 * shell. This file is about the component's own contract.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppVersion } from "@/components/layout/app-version";
import { quizHubBrand, type BrandId } from "@/data/brand";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { loginCopy } from "@/data/pages/login";
import { shellCopy } from "@/data/pages/shell";
import { loginCopyFor } from "@/lib/auth-copy";
import { demoCopyFor } from "@/lib/auth/demo-surface";

/** The version the stub supplies — nothing in the tree contains it. */
const STUBBED = "9.9.9";

const TAG = "https://github.com/riolabs-ai/alignsynch/releases/tag/v9.9.9";

/** The badge's markup for one surface's copy. */
function render(copy: Parameters<typeof AppVersion>[0]["copy"], compact = false): string {
  return renderToStaticMarkup(createElement(AppVersion, { copy, compact }));
}

/** The anchor's attributes and text, read out of the markup a node render produced. */
function anchor(html: string): { href: string; title: string; text: string } {
  const tag = html.match(/<a\b[^>]*>/)?.[0] ?? "";
  const href = tag.match(/href="([^"]*)"/)?.[1] ?? "";
  const title = tag.match(/title="([^"]*)"/)?.[1] ?? "";
  const text = html.replace(/<[^>]*>/g, "").trim();
  return { href, title, text };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the version badge", () => {
  it("prints the version the build inlined, and links to that exact tag", () => {
    vi.stubEnv("APP_VERSION", STUBBED);

    const { href, text } = anchor(render(shellCopy(alignSynchBrand)));

    expect(href).toBe(TAG);
    expect(text).toBe(`Version ${STUBBED}`);
  });

  it("never falls back to /releases/latest", () => {
    vi.stubEnv("APP_VERSION", STUBBED);

    expect(render(shellCopy(alignSynchBrand))).not.toContain("releases/latest");
  });

  it("is an anchor with an href, not a click handler", () => {
    vi.stubEnv("APP_VERSION", STUBBED);

    const html = render(shellCopy(alignSynchBrand));

    expect(html).toMatch(/^<a\b[^>]*href="/);
    expect(html).not.toContain("onClick");
  });

  it("names the version in its title as well as its text, for a screen reader", () => {
    vi.stubEnv("APP_VERSION", STUBBED);

    const { title, text } = anchor(render(shellCopy(alignSynchBrand)));

    expect(title).toContain(STUBBED);
    expect(title).toContain("release notes");
    expect(text).toContain(STUBBED);
  });

  it("has a short form for the collapsed rail, from the same fixture", () => {
    vi.stubEnv("APP_VERSION", STUBBED);

    expect(anchor(render(shellCopy(alignSynchBrand), true)).text).toBe(`v${STUBBED}`);
  });

  it("renders on both brands, from each surface's own fixture", () => {
    vi.stubEnv("APP_VERSION", STUBBED);

    const copies = {
      "quizhub shell": shellCopy(quizHubBrand),
      "quizhub login fixture": loginCopy(quizHubBrand),
      "alignsynch shell": shellCopy(alignSynchBrand),
      "alignsynch login fixture": loginCopy(alignSynchBrand),
    };

    for (const [surface, copy] of Object.entries(copies)) {
      expect(anchor(render(copy)).href, surface).toBe(TAG);
    }
  });

  /**
   * The regression the *running app* found and the build could not (this is why the card asks for
   * rendered text, not a green `next build`): `/login` does not hand `AppVersion` the fixture, it
   * hands it `loginCopyFor`'s projection — which rebuilds the section list — wrapped in
   * `demoCopyFor`. A section the projection drops throws `PageCopy: no section "version"` on the
   * request, and `next build` never renders this route, so the first symptom is HTTP 500.
   */
  it("survives the login page's copy projection, on both brands", () => {
    vi.stubEnv("APP_VERSION", STUBBED);

    const brands: readonly (readonly [BrandId, Parameters<typeof loginCopy>[0]])[] = [
      ["quizhub", quizHubBrand],
      ["alignsynch", alignSynchBrand],
    ];

    for (const [brandId, record] of brands) {
      const fixture = loginCopy(record);
      const projected = demoCopyFor({ kind: "off" }, loginCopyFor(fixture, brandId), fixture);
      expect(anchor(render(projected)).href, brandId).toBe(TAG);
    }
  });

  it("reads the version at render time, so a bump is a rebuild and nothing else", () => {
    vi.stubEnv("APP_VERSION", "1.2.3");
    expect(anchor(render(shellCopy(alignSynchBrand))).text).toBe("Version 1.2.3");

    vi.stubEnv("APP_VERSION", STUBBED);
    expect(anchor(render(shellCopy(alignSynchBrand))).text).toBe(`Version ${STUBBED}`);
  });
});
