/**
 * `/affiliate` answers 404 while `commerce.affiliate` is off (issue #291, #175's rule).
 *
 * The route shipped for months while its flag said `false`, so every build served a programme
 * that pays nobody — and on the AlignSynch build the copy interpolated the brand, so a client
 * demo read "…by promoting AlignSynch". The fix is the same one `/leaderboard` already has: call
 * `notFound()` before the page reads anything, and read the flag per request.
 *
 * This file proves both halves against the **route module**, not against `isEnabled`: a route
 * that resolves the flag and then renders anyway passes a flag test and fails a visitor. The
 * affirmative case is here on purpose — if the page threw for any other reason, "the gate works"
 * would be true on a page that never renders at all.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import AffiliatePage from "@/app/(mainlayout)/affiliate/page";

afterEach(() => {
  vi.unstubAllEnvs();
});

/** The sentinel Next throws from `notFound()`; its message/digest names the 404. */
function is404Sentinel(error: unknown): boolean {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest?: unknown }).digest)
      : "";
  const message = error instanceof Error ? error.message : "";
  return /404|NOT_FOUND/i.test(`${message} ${digest}`);
}

describe("/affiliate with commerce.affiliate off", () => {
  it("refuses to render: the default (unset) asks for the 404", () => {
    vi.stubEnv("FLAG_COMMERCE_AFFILIATE", undefined);

    let thrown: unknown;
    try {
      AffiliatePage();
    } catch (error) {
      thrown = error;
    }
    expect(thrown, "the page rendered with the flag off").toBeDefined();
    expect(is404Sentinel(thrown)).toBe(true);
  });

  it("refuses on an explicit 0 as well", () => {
    vi.stubEnv("FLAG_COMMERCE_AFFILIATE", "0");

    expect(() => AffiliatePage()).toThrow();
  });
});

describe("/affiliate with commerce.affiliate on", () => {
  it("renders the programme — the gate is the flag, not a page that never works", () => {
    vi.stubEnv("FLAG_COMMERCE_AFFILIATE", "1");

    const html = renderToStaticMarkup(createElement(AffiliatePage));
    expect(html.length).toBeGreaterThan(1000);
    // A phrase only the affiliate fixture carries, so "it rendered something" is not the claim.
    expect(html).toContain("Turn Your Audience Into");
    expect(html).toContain("Affiliate Dashboard");
  });
});
