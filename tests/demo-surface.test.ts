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
import { loginPageCopy } from "@/data/pages/login";
import { demoSurfaceFor } from "@/lib/auth/demo-surface";
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
