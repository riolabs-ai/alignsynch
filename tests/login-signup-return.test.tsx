/**
 * `/login`'s "Sign up" link keeps the return (#1187).
 *
 * The two halves of the account round trip must agree: a signed-out POST to the flow's stage 4
 * answers `303 → /login?next=<commit page>`, so the person who has no account yet takes the
 * **Sign up** link out of that page. It was `<Link href="/register">` — a bare address that drops
 * the query — so `/register` fell back to the brand's `AFTER_SIGN_IN` (`/dashboard`) and the
 * relationship the person had just described was stranded behind a draft cookie nothing read.
 *
 * `registerPathFor()` is the builder `#867` added for exactly this hop ("what was missing was a
 * caller"); the reverse link on `/register` has always carried it (`loginPathFor(destination)`).
 * This file pins the forward one, and pins that an unsafe `next` cannot ride through it — the view
 * is a client module, so the value it forwards is re-validated by `safeNextPath`, never trusted.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
}));

import { LoginView } from "@/components/auth/login-view";
import { loginPageCopy } from "@/data/pages/login";
import { AUTH_MARK_SRC_BY_BRAND, AUTH_MARKS_BY_BRAND } from "@/lib/auth/marks";

import { createCommitPath } from "@/lib/flow/paths";

const COMMIT = createCommitPath("relationship-basics");

const props = (next: string) => ({
  copy: loginPageCopy,
  marks: AUTH_MARKS_BY_BRAND.alignsynch,
  markSrc: AUTH_MARK_SRC_BY_BRAND.alignsynch,
  next,
  googleFailure: false,
  demo: { kind: "off" as const },
  providerHint: async () => false,
  startGoogle: async (): Promise<never> => {
    throw new Error("startGoogle must not be called during a render");
  },
});

/** The Sign-up anchor's `href`, as the page renders it. */
function signUpHref(next: string): string | null {
  const html = renderToStaticMarkup(createElement(LoginView, props(next)));
  const match = html.match(/<a[^>]+href="([^"]*\/register[^"]*)"[^>]*>/);
  return match === null ? null : match[1];
}

describe("the sign-in page's Sign-up link", () => {
  it("carries the stage the person was going to", () => {
    expect(signUpHref(COMMIT)).toBe(`/register?next=${encodeURIComponent(COMMIT)}`);
  });

  it("carries a query-carrying destination whole", () => {
    const withQuery = `${COMMIT}?instance=abc123`;
    expect(signUpHref(withQuery)).toBe(`/register?next=${encodeURIComponent(withQuery)}`);
  });

  it("never forwards a value that leaves this site", () => {
    // `safeNextPath` is the first gate, and the client may not weaken it: whatever it forwards is
    // still a path on this site, so a hostile `next` can never become an off-site `?next=`.
    const forwarded = signUpHref("//evil.example/register");
    expect(forwarded).not.toBeNull();
    const target = decodeURIComponent((forwarded ?? "").replace("/register?next=", ""));
    expect(target.startsWith("/")).toBe(true);
    expect(target.startsWith("//")).toBe(false);
  });
});
