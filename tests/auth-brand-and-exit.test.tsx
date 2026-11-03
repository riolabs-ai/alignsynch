/**
 * Every auth screen wears the build's mark and offers a way out to the site.
 *
 * Two defects, one file, because they were the same absence measured twice on 2026-11-02:
 *
 *   1. **The brand reached `/login`, `/register` and the 404 — and stopped there.** `AUTH_MARKS_BY_
 *      BRAND` is resolved on the server and passed down as ids; `/forgot-password` and both reset
 *      routes drew no mark at all, so an AlignSynch person who followed a reset link from their
 *      mail landed on a page with nothing of the product on it.
 *   2. **No auth page had a link to `/`.** `/login` 0, `/register` 0, `/forgot-password` 0 — a
 *      visitor who did not want to sign in had to edit the address bar. That is the same defect as
 *      a detail view with no exit.
 *
 * The assertions are on rendered HTML, not on the source, because both defects are invisible to a
 * typecheck: a mark that is passed but not drawn, and an anchor that exists in a comment. The mark
 * is read off the glyph `lucide-react` renders (`lucide-users` on the alignment build,
 * `lucide-book-open` on the quiz build), which is the same signal `tests/register-view.test.tsx`
 * uses — one glyph, one class, no second registry to drift.
 *
 * The fourth claim is the vocabulary: the alignment build's sign-in line says **relationships**,
 * because "assessment" is the scored Gap analysis a finished session produces and never the
 * container a person signs in to see.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
}));

import { ForgotPasswordView } from "@/components/auth/forgot-password-view";
import { LoginView } from "@/components/auth/login-view";
import { RegisterView } from "@/components/auth/register-view";
import { ResetCompleteView } from "@/components/auth/reset-complete-view";
import { ResetPasswordView } from "@/components/auth/reset-password-view";
import type { Brand } from "@/content/brand";
import { quizHubBrand } from "@/data/brand";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { loginCopy } from "@/data/pages/login";
import {
  resetCompletePageCopy,
  resetFormPageCopy,
  resetRequestPageCopy,
} from "@/data/pages/password-reset";
import { registerCopy } from "@/data/pages/register";
import { loginCopyFor, registerCopyFor } from "@/lib/auth-copy";
import { AUTH_MARKS_BY_BRAND } from "@/lib/auth/marks";
import { AFTER_SIGN_IN_BY_BRAND } from "@/lib/auth/paths";
import type { StartGoogleSignInResult } from "@/lib/auth/google-flow";
import type { ResetRequestOutcome, ResetSetOutcome } from "@/lib/auth/reset-token";

const BRANDS = [
  ["quizhub", quizHubBrand as Brand],
  ["alignsynch", alignSynchBrand as Brand],
] as const;

/** The sign-in view's seven props, as `app/(auth)/login/page.tsx` assembles them. */
const loginView = (id: (typeof BRANDS)[number][0], record: Brand) =>
  createElement(LoginView, {
    copy: loginCopyFor(loginCopy(record), id),
    marks: AUTH_MARKS_BY_BRAND[id],
    next: AFTER_SIGN_IN_BY_BRAND[id],
    googleFailure: false,
    demo: { kind: "off" },
    providerHint: async () => false,
    startGoogle: async (): Promise<StartGoogleSignInResult> => ({
      ok: true,
      url: "https://example.test",
    }),
  });

const registerView = (id: (typeof BRANDS)[number][0], record: Brand) =>
  createElement(RegisterView, {
    copy: registerCopyFor(registerCopy(record), id),
    destination: AFTER_SIGN_IN_BY_BRAND[id],
    marks: AUTH_MARKS_BY_BRAND[id],
  });

/** Every `href` in a rendered tree, in document order. */
const hrefsOf = (html: string): string[] => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

/** Every `lucide-*` glyph class in a rendered tree — the mark the server chose, as drawn. */
const marksOf = (html: string): string[] =>
  [...new Set([...html.matchAll(/lucide-([a-z-]+)/g)].map((m) => m[1]))].sort();

/**
 * The auth surfaces, as the router mounts them: the page modules and the props they resolve.
 *
 * `/reset/[token]` is rendered with a `valid` token state because that is the shape that draws the
 * form — the dead-link bands are `tests/password-reset.test.ts`'s subject, and they wear the same
 * header.
 */
const surfaces = (id: (typeof BRANDS)[number][0], record: Brand) => ({
  login: renderToStaticMarkup(loginView(id, record)),
  register: renderToStaticMarkup(registerView(id, record)),
  "forgot-password": renderToStaticMarkup(
    createElement(ForgotPasswordView, {
      copy: resetRequestPageCopy,
      request: async (): Promise<ResetRequestOutcome> => ({ kind: "sent" }),
      mark: AUTH_MARKS_BY_BRAND[id].hero,
    }),
  ),
  reset: renderToStaticMarkup(
    createElement(ResetPasswordView, {
      copy: resetFormPageCopy,
      token: "a-real-looking-token",
      state: "valid",
      setPassword: async (): Promise<ResetSetOutcome> => ({ kind: "set" }),
      mark: AUTH_MARKS_BY_BRAND[id].hero,
    }),
  ),
  "reset/complete": renderToStaticMarkup(
    createElement(ResetCompleteView, {
      copy: resetCompletePageCopy,
      mark: AUTH_MARKS_BY_BRAND[id].hero,
    }),
  ),
});

describe("every auth screen", () => {
  it("links back to the site, on both brands", () => {
    for (const [id, record] of BRANDS) {
      for (const [name, html] of Object.entries(surfaces(id, record))) {
        expect(hrefsOf(html), `${id} /${name} has no way back to /`).toContain("/");
      }
    }
  });

  it("draws this build's mark, and never the other brand's", () => {
    for (const [id, record] of BRANDS) {
      const hero = AUTH_MARKS_BY_BRAND[id].hero;
      const foreign = BRANDS.filter(([other]) => other !== id).map(
        ([other]) => AUTH_MARKS_BY_BRAND[other].hero,
      );
      for (const [name, html] of Object.entries(surfaces(id, record))) {
        const marks = marksOf(html);
        expect(marks, `${id} /${name} does not draw ${hero}`).toContain(hero);
        for (const other of foreign) {
          expect(marks, `${id} /${name} draws ${other}`).not.toContain(other);
        }
      }
    }
  });
});

describe("the sign-in card", () => {
  it("puts the forgotten-password link on the remember row, right-aligned", () => {
    const html = renderToStaticMarkup(loginView("alignsynch", alignSynchBrand as Brand));

    // The row, read as a row: the checkbox's label and the forgot link share one parent element,
    // and that parent is the one that spreads them apart.
    const row = html.match(
      /<div class="flex items-center justify-between[^"]*">[\s\S]*?<\/div><\/div>/,
    );
    expect(row, "no justify-between row wraps the remember field").not.toBeNull();
    expect(row?.[0]).toContain('id="remember"');
    expect(row?.[0]).toContain('href="/forgot-password"');
  });

  it("says relationships, not assessments, on the alignment build", () => {
    const text = renderToStaticMarkup(loginView("alignsynch", alignSynchBrand as Brand)).replace(
      /<[^>]*>/g,
      " ",
    );

    expect(text).toContain("Sign in to see your relationships");
    expect(text).not.toMatch(/assessment/i);
  });
});
