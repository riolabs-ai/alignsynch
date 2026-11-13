/**
 * `/login` draws this build's marks, and no quiz glyph on the alignment build.
 *
 * `/register` got the same treatment in `tests/register-view.test.tsx`; `/login` was the surface
 * left behind. Its illustration panel and its mobile header wrote `BookOpen` inline, so the
 * AlignSynch sign-in page — the first screen of the product — opened on a quiz book, while the
 * card's two tiles beside it were already brand-aware (their mark is the fixture's stat id, and
 * `stats-alignsynch` names ids that map does not know, which is why they get the neutral mark).
 *
 * The view is a client module and is told which mark to draw (`marks`, an `AuthMarkSet` from
 * `lib/auth/marks.ts`); these cases are the ones a static render can see, so they are the ones
 * pinned here. The rendered HTML of the built pages is the card's own check: `pnpm start` under
 * each `BRAND`, then a count of `lucide-book-open` and `lucide-trophy` in `/login`'s response.
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
import type { Brand } from "@/content/brand";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { quizHubBrand } from "@/data/brand";
import { loginCopy } from "@/data/pages/login";
import { loginCopyFor } from "@/lib/auth-copy";
import { AUTH_MARK_SRC_BY_BRAND, AUTH_MARKS_BY_BRAND } from "@/lib/auth/marks";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const BRANDS = [
  ["quizhub", quizHubBrand as Brand],
  ["alignsynch", alignSynchBrand as Brand],
] as const;

/**
 * The props `app/(auth)/login/page.tsx` hands the view, minus the brand-dependent ones it cannot.
 * The copy is rebuilt per brand from the fixture's own generator (`loginCopy(record)`) so each case
 * renders its own hero sentence rather than the build's — `loginPageCopy` is the one brand this
 * process was started with.
 */
const viewProps = (id: (typeof BRANDS)[number][0], record: Brand) => ({
  copy: loginCopyFor(loginCopy(record), id),
  marks: AUTH_MARKS_BY_BRAND[id],
  markSrc: AUTH_MARK_SRC_BY_BRAND[id],
  next: "/dashboard",
  googleFailure: false,
  demo: { kind: "off" as const },
  providerHint: async () => false,
  // Never called by a static render: the Google path starts from a click.
  startGoogle: async (): Promise<never> => {
    throw new Error("startGoogle must not be called during a render");
  },
});

describe("the sign-in panel's marks on both brands", () => {
  it("draws the brand's own mark, on the panel and on the mobile header", () => {
    for (const [id, record] of BRANDS) {
      const hero = AUTH_MARKS_BY_BRAND[id].hero;
      const html = renderToStaticMarkup(createElement(LoginView, viewProps(id, record)));
      // Both are always in the markup — `hidden lg:flex` / `lg:hidden` decide which one a reader
      // sees — so the two chrome marks are the floor this component owes on every brand. QuizHub
      // adds a third because its `categories` tile draws the same book (`STAT_MARKS`), which is
      // why the exact counts are pinned per brand below rather than here.
      //
      // A brand whose mark is its own image draws that image, not a glyph: the alignment build
      // used to draw a lucide person pair here, which is the defect this assertion replaced.
      const drawn =
        hero === "brand-mark"
          ? html.split(`src="${AUTH_MARK_SRC_BY_BRAND[id]}"`).length - 1
          : html.split(`lucide-${hero}`).length - 1;
      expect(drawn, `${id} draws its ${hero} mark`).toBeGreaterThanOrEqual(2);
      if (hero === "brand-mark") {
        expect(html, `${id} still draws a stand-in glyph`).not.toContain("lucide-users");
      }
    }
  });

  it("leaves no quiz mark on the alignment build", () => {
    const html = renderToStaticMarkup(
      createElement(LoginView, viewProps("alignsynch", alignSynchBrand)),
    );

    // The defect this card exists for: a hardcoded `BookOpen` on the panel and on the header.
    expect(html).not.toContain("lucide-book-open");
    // And the quiz trophy, which the sign-in screen never drew — but a mark chosen by habit
    // instead of by the map would land here next.
    expect(html).not.toContain("lucide-trophy");
  });

  it("keeps the quiz build exactly as it was", () => {
    const html = renderToStaticMarkup(createElement(LoginView, viewProps("quizhub", quizHubBrand)));

    // QuizHub's two stat tiles keep their stat marks (`players` → trophy, `categories` → book)
    // beside the panel's book, which is what the page has always rendered.
    expect(html.split("lucide-book-open").length - 1).toBe(3);
    expect(html.split("lucide-trophy").length - 1).toBe(1);
  });
});

/**
 * The OAuth control's mark (#777).
 *
 * Stage 4 of the create flow mounts this same view inside a stage column, so the Google control a
 * person meets there is this one. The issue asks for the mark so the control is recognised by shape
 * as well as words; the fixture's own comment says `label` is the button's whole accessible name,
 * which is what makes a decorative mark safe. Both halves are pinned here.
 */
describe("the Google control's mark (#777)", () => {
  /** The one `<button>` whose words are the Google label — the mark must sit inside it. */
  function googleButton(html: string): string {
    const buttons = html.match(/<button[^>]*>[\s\S]*?<\/button>/g) ?? [];
    return buttons.find((button) => button.includes("Continue with Google")) ?? "";
  }

  it("draws the provider's own mark inside the button, on both brands", () => {
    for (const [id, record] of BRANDS) {
      const html = renderToStaticMarkup(createElement(LoginView, viewProps(id, record)));
      const button = googleButton(html);
      expect(button, `${id} renders the Google control`).not.toBe("");
      // The mark is the four-colour G itself, not a stand-in glyph from the brand's own set.
      for (const fill of ["#4285F4", "#34A853", "#FBBC05", "#EA4335"]) {
        expect(button, `${id} draws the ${fill} path`).toContain(`fill="${fill}"`);
      }
      // One button, one mark: a click and a keyboard focus still have one target.
      expect(html.split("Continue with Google").length - 1, `${id} draws it once`).toBe(1);
    }
  });

  it("keeps the fixture's label as the button's whole accessible name", () => {
    const record = quizHubBrand as Brand;
    const label = itemLabel(
      sectionOf(loginCopyFor(loginCopy(record), "quizhub"), "google"),
      "label",
    );
    const button = googleButton(
      renderToStaticMarkup(createElement(LoginView, viewProps("quizhub", record))),
    );

    // The mark contributes no words: hidden from the accessibility tree, no title of its own.
    expect(button).toContain('aria-hidden="true"');
    expect(button).not.toContain("<title");
    // A logo alone is not an accessible name — the text the label names is still the button.
    expect(button.replace(/<[^>]*>/g, "").trim()).toBe(label);
  });
});
