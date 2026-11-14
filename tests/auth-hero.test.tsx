/**
 * The two welcome tiles are **one component, mounted by both auth pages** (#971).
 *
 * `/login` has drawn the pair beside its form since the split panel was built; `/register` drew a
 * panel of its own without them, so the sign-up page introduced the product with a sentence and
 * nothing else. The owner's decision (2026-11-13) is narrower than the issue's title: the tiles
 * belong on both full-page routes, each page keeps its own headline, and the create flow's Account
 * stage stays compact. This file pins the four things that decision means, per brand:
 *
 *   page      `/login` and `/register` both render the same two tiles, once each;
 *   headline  `/register` still leads with its own `h1` and the tiles sit under it — reusing the
 *             sign-in panel would have made the sign-up page lead with sign-in's `h2`;
 *   embedded  the in-modal Account stage draws no panel and no tiles, because it is a step in a
 *             flow;
 *   once      the pair is drawn once per render — a second copy in `register-view.tsx` is the
 *             defect the extraction exists to prevent, and it would pass a "does /register have
 *             the tiles?" assertion.
 *
 * The words are read out of the fixture the two routes share their band from (`data/pages/login.ts`)
 * rather than typed here: a label in a test is a second home for copy.
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
import { RegisterView } from "@/components/auth/register-view";
import type { Brand } from "@/content/brand";
import { quizHubBrand } from "@/data/brand";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { loginCopy } from "@/data/pages/login";
import { registerCopy } from "@/data/pages/register";
import { heroTilesFor, loginCopyFor, registerCopyFor } from "@/lib/auth-copy";
import { AUTH_MARK_SRC_BY_BRAND, AUTH_MARKS_BY_BRAND } from "@/lib/auth/marks";
import { AFTER_SIGN_IN_BY_BRAND } from "@/lib/auth/paths";

const BRANDS = [
  ["quizhub", quizHubBrand as Brand],
  ["alignsynch", alignSynchBrand as Brand],
] as const;

/** The tile labels the two pages owe on one brand, read out of the band both mount. */
const tileLabels = (id: (typeof BRANDS)[number][0], record: Brand) =>
  (heroTilesFor(loginCopy(record), id).items ?? []).map((item) => item.label);

const loginProps = (id: (typeof BRANDS)[number][0], record: Brand) => ({
  copy: loginCopyFor(loginCopy(record), id),
  marks: AUTH_MARKS_BY_BRAND[id],
  markSrc: AUTH_MARK_SRC_BY_BRAND[id],
  next: AFTER_SIGN_IN_BY_BRAND[id],
  googleFailure: false,
  demo: { kind: "off" as const },
  providerHint: async () => false,
  startGoogle: async (): Promise<never> => {
    throw new Error("startGoogle must not be called during a render");
  },
});

const registerProps = (id: (typeof BRANDS)[number][0], record: Brand) => ({
  copy: registerCopyFor(registerCopy(record), id),
  destination: AFTER_SIGN_IN_BY_BRAND[id],
  marks: AUTH_MARKS_BY_BRAND[id],
  markSrc: AUTH_MARK_SRC_BY_BRAND[id],
  stats: heroTilesFor(loginCopy(record), id),
});

/** How many times `needle` appears in `haystack`. */
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe("the welcome tiles on both brands (#971)", () => {
  it("renders both tiles on /login and on /register", () => {
    for (const [id, record] of BRANDS) {
      const labels = tileLabels(id, record);
      expect(labels.length, `${id} declares two tiles`).toBe(2);

      const signIn = renderToStaticMarkup(createElement(LoginView, loginProps(id, record)));
      const signUp = renderToStaticMarkup(createElement(RegisterView, registerProps(id, record)));

      for (const label of labels) {
        expect(signIn, `${id} /login draws "${label}"`).toContain(label);
        expect(signUp, `${id} /register draws "${label}"`).toContain(label);
      }
    }
  });

  it("draws each tile exactly once per page", () => {
    for (const [id, record] of BRANDS) {
      const signIn = renderToStaticMarkup(createElement(LoginView, loginProps(id, record)));
      const signUp = renderToStaticMarkup(createElement(RegisterView, registerProps(id, record)));

      for (const label of tileLabels(id, record)) {
        // A second, hand-written copy of the pair in either view would still pass the case above
        // and fail here — which is the regression this extraction exists to prevent.
        expect(count(signIn, label), `${id} /login draws "${label}" once`).toBe(1);
        expect(count(signUp, label), `${id} /register draws "${label}" once`).toBe(1);
      }
    }
  });

  it("keeps /register's own h1 above the tiles, and /login's h2 on its own panel", () => {
    for (const [id, record] of BRANDS) {
      const signUpProps = registerProps(id, record);
      const loginHeading = loginCopyFor(loginCopy(record), id).heading;
      const signUp = renderToStaticMarkup(createElement(RegisterView, signUpProps));
      const signIn = renderToStaticMarkup(createElement(LoginView, loginProps(id, record)));

      const headline = `<h1 class="text-4xl font-bold mb-4">${signUpProps.copy.heading}</h1>`;
      expect(signUp, `${id} /register leads with its own h1`).toContain(headline);

      // The tiles sit under that headline, not above it: the sign-up page introduces itself first,
      // then makes the claim. Both are on the same panel.
      const firstTile = tileLabels(id, record)[0] ?? "";
      expect(signUp.indexOf(headline), `${id} headline precedes the tiles`).toBeLessThan(
        signUp.indexOf(firstTile),
      );

      // And the two panels stay distinct: sign-in's headline is an `h2` on `/login`, and the
      // sign-up page must not have been rebuilt out of sign-in's panel to get the tiles.
      expect(signIn, `${id} /login keeps its h2`).toContain(
        `<h2 class="text-4xl font-bold mb-4">${loginHeading}</h2>`,
      );
      expect(signUp, `${id} /register is not sign-in's panel`).not.toContain(`>${loginHeading}<`);
    }
  });

  it("draws no hero inside the create flow's Account stage", () => {
    for (const [id, record] of BRANDS) {
      const signUpProps = registerProps(id, record);
      const signUpStage = renderToStaticMarkup(
        createElement(RegisterView, { ...signUpProps, layout: "embedded" as const }),
      );
      const signInStage = renderToStaticMarkup(
        createElement(LoginView, { ...loginProps(id, record), layout: "embedded" as const }),
      );

      // The stage is a step, not a landing. `account-panel.tsx` opens on sign-up, so that is the
      // one that has to draw nothing: no panel, no tiles, no headline, no backdrop.
      for (const label of tileLabels(id, record)) {
        expect(signUpStage, `${id} embedded sign-up stage draws no tile`).not.toContain(label);
      }
      expect(signUpStage, `${id} embedded sign-up stage draws no panel`).not.toContain(
        "bg-black/20",
      );
      expect(signUpStage, `${id} embedded sign-up stage draws no headline`).not.toContain(
        signUpProps.copy.heading,
      );

      // Sign-in keeps the shape #824 gave it: the panel is still in the tree but carries `hidden`,
      // so it is out of the layout rather than a second hero inside the stage. Pinned here so the
      // extraction cannot quietly turn it into a visible one.
      expect(signInStage, `${id} embedded sign-in stage hides its panel`).toContain(
        '<div class="hidden">',
      );
      expect(signInStage, `${id} embedded sign-in stage has no split panel`).not.toContain(
        "hidden lg:flex",
      );
    }
  });
});
