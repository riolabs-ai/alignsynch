/**
 * The welcome hero is **one component, mounted by both auth pages** (#971).
 *
 * `/login` drew the panel — the mark, the heading, the sentence and the two tiles — and `/register`
 * drew its own, older panel with no tiles at all, so the sign-up page opened on a bare form while
 * sign-in explained the product. The owner's decision (2026-11-13) is a shared hero on both
 * full-page routes and a compact stage inside the create flow, so this file pins the three things
 * that decision means, per brand:
 *
 *   page      `/login` and `/register` both render the same two tiles;
 *   once      the hero is drawn once per render — a second copy in `register-view.tsx` is the
 *             defect the extraction exists to prevent, and it would pass a "does /register have
 *             the tiles?" assertion;
 *   embedded  the in-modal Account stage draws no hero at all, because it is a step in a flow.
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

/** The tile labels the hero owes on one brand, read out of the band both routes mount. */
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

describe("the auth hero on both brands (#971)", () => {
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

  it("draws the panel once, not once per view's own copy of the markup", () => {
    for (const [id, record] of BRANDS) {
      const props = registerProps(id, record);
      const signUp = renderToStaticMarkup(createElement(RegisterView, props));

      // `copy.heading` is the panel's headline and nothing else renders it: a second copy of the
      // hero in `register-view.tsx` would double this count while keeping the tiles assertion
      // above green, which is exactly the regression this case exists for.
      expect(signUp.split(props.copy.heading).length - 1, `${id} draws one panel`).toBe(1);
    }
  });

  it("draws no hero inside the create flow's Account stage", () => {
    for (const [id, record] of BRANDS) {
      const props = registerProps(id, record);
      const embedded = renderToStaticMarkup(
        createElement(RegisterView, { ...props, layout: "embedded" as const }),
      );

      // The stage is a step, not a landing: no panel, no headline, no tiles — and the panel's
      // mark is absent too, because the stage already carries the flow's own chrome.
      for (const label of tileLabels(id, record)) {
        expect(embedded, `${id} embedded stage draws no tile`).not.toContain(label);
      }
      expect(embedded, `${id} embedded stage draws no headline`).not.toContain(props.copy.heading);
      expect(embedded, `${id} embedded stage is the form column alone`).not.toContain(
        "bg-black/20",
      );
    }
  });
});
