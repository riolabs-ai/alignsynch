/**
 * What `/login` may render for the demo (#218) — three states, none of which can leak the other.
 *
 * The loop this pins: `/login` carries the entry link to the PIN gate *or* the three role buttons,
 * never both. If both were reachable at once a reader could bounce `/login → /demo → /login`
 * forever, and if the link survived unlocking it would ask for a step the cookie already granted.
 * The three states are also the whole of the "no demo when demo mode is off" rule: `off` renders
 * nothing — not a disabled control, not a hint.
 *
 * The anchor's markup is asserted, not described: the acceptance asks that the control be a real
 * `<a href="/demo">` whose accessible name equals its visible text, and both of those are
 * properties of the string React renders.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DemoEntry } from "@/components/auth/demo-entry";
import type { BrandId } from "@/data/brand";
import { loginPageCopy } from "@/data/pages/login";
import { loginCopyFor } from "@/lib/auth-copy";
import { demoCopyFor, demoSurfaceFor } from "@/lib/auth/demo-surface";
import { verifyUnlock } from "@/lib/auth/demo-unlock";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const SECRET = "a-test-secret-that-is-not-any-deployment's";
const NOW = 1_793_400_000_000;

const DEMO: import("@/lib/auth/demo-mode").DemoMode = { kind: "demo", production: false };

describe("which demo surface /login draws", () => {
  it("renders nothing when demo mode is off or refused, whatever the cookie says", () => {
    const unlock = verifyUnlock({
      value: undefined,
      secret: SECRET,
      now: NOW,
    });
    for (const mode of [
      { kind: "off", reason: "unset" },
      { kind: "off", reason: "other-value" },
      { kind: "refused", reason: "production" },
      { kind: "refused", reason: "no-pin" },
    ] as const) {
      expect(demoSurfaceFor(mode, unlock).kind).toBe("off");
      expect(demoSurfaceFor(mode, null).kind).toBe("off");
    }
  });

  it("shows the entry link — and no buttons — for a browser with no cookie", () => {
    const absent = verifyUnlock({ value: undefined, secret: SECRET, now: NOW });
    expect(demoSurfaceFor(DEMO, absent).kind).toBe("entry");
  });

  it("shows the role buttons once the cookie verifies", () => {
    expect(demoSurfaceFor(DEMO, { ok: true, expiresAt: NOW + 60_000 }).kind).toBe("roles");
  });

  it("treats every refusal — expired, tampered, malformed, unsignable — as the entry state", () => {
    for (const reason of ["absent", "malformed", "signature", "expired", "no-secret"] as const) {
      expect(demoSurfaceFor(DEMO, { ok: false, reason }).kind).toBe("entry");
    }
  });
});

describe("the copy a response carries", () => {
  const DEMO_SECTION_IDS = ["demo-entry", "demo"];

  /** The ids a call ships, for the composed copy the page actually builds. */
  const ids = (surface: Parameters<typeof demoCopyFor>[0]) =>
    (demoCopyFor(surface, loginPageCopy).sections ?? []).map((section) => section.id);

  /**
   * The ids `/login` ships for one brand — `copy` is what `loginCopyFor` projected (the two the
   * card asks for), `fixture` is the route fixture the demo's words live in. This is the page's own
   * call, brand for brand, so the assertions below are about the response and not a simplification.
   */
  const idsForBrand = (surface: Parameters<typeof demoCopyFor>[0], brandId: BrandId) =>
    (demoCopyFor(surface, loginCopyFor(loginPageCopy, brandId), loginPageCopy).sections ?? []).map(
      (section) => section.id,
    );

  it("ships neither demo section when demo mode is off", () => {
    expect(ids({ kind: "off" })).not.toContain("demo-entry");
    expect(ids({ kind: "off" })).not.toContain("demo");
    // …and leaves every other section of the route fixture exactly as it was.
    const others = (loginPageCopy.sections ?? [])
      .filter((section) => !DEMO_SECTION_IDS.includes(section.id))
      .map((section) => section.id);
    expect(ids({ kind: "off" })).toEqual(others);
  });

  it("ships the anchor's copy in `entry` and the role block's in `roles`, never both", () => {
    expect(ids({ kind: "entry" })).toContain("demo-entry");
    expect(ids({ kind: "entry" })).not.toContain("demo");
    expect(ids({ kind: "roles" })).toContain("demo");
    expect(ids({ kind: "roles" })).not.toContain("demo-entry");
  });

  /**
   * #225 × #218: `loginCopyFor` rebuilds the section list from the ids a brand owns (`sign-in`,
   * `stats`), so the demo sections are not in the projected copy at all. If `demoCopyFor` only
   * filtered what it was handed, every deployment would ship a `/login` that knows the demo exists
   * and renders nothing — the link on one brand, nothing on the other. So the projection is called
   * with both brands, and the demo section has to survive it.
   */
  it("keeps the demo sections that the brand projection dropped", () => {
    for (const brandId of ["quizhub", "alignsynch"] as const) {
      const projected = loginCopyFor(loginPageCopy, brandId);
      expect((projected.sections ?? []).map((section) => section.id)).not.toContain("demo");
      expect(idsForBrand({ kind: "entry" }, brandId)).toContain("demo-entry");
      expect(idsForBrand({ kind: "roles" }, brandId)).toContain("demo");
      expect(idsForBrand({ kind: "off" }, brandId)).not.toContain("demo");
      expect(idsForBrand({ kind: "off" }, brandId)).not.toContain("demo-entry");
    }
  });
});

describe("the entry control", () => {
  const markup = renderToStaticMarkup(createElement(DemoEntry, { copy: loginPageCopy }));
  const entry = sectionOf(loginPageCopy, "demo-entry");
  const link = itemLabel(entry, "link");

  it("is a real anchor to the gate, present in the server HTML", () => {
    expect(markup).toContain('href="/demo"');
    expect(markup).toMatch(/<a [^>]*href="\/demo"/);
    // Not a button and not a form submit: nothing here needs hydration to work.
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("<form");
  });

  it("says what it is, and says a PIN is required, without inventing anything", () => {
    expect(link).toBe("Demo sign-in");
    expect(markup).toContain(itemLabel(entry, "note"));
    expect(markup.toLowerCase()).not.toContain("free");
  });

  it("has an accessible name equal to its visible text", () => {
    const anchor = /<a\b[^>]*>([\s\S]*?)<\/a>/.exec(markup);
    expect(anchor).not.toBeNull();
    const visibleText = (anchor?.[1] ?? "").replace(/<[^>]*>/g, "").trim();
    expect(visibleText).toBe(link);
    // No aria-label overriding it, so the browser computes the name from the same text.
    expect(markup).not.toContain("aria-label");
    // The description is an association, not part of the name.
    expect(markup).toContain('aria-describedby="demo-entry-note"');
    expect(markup).toContain('id="demo-entry-note"');
  });
});
