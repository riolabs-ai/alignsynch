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
import { AUTH_MARKS_BY_BRAND } from "@/lib/auth/marks";

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
      const html = renderToStaticMarkup(createElement(LoginView, viewProps(id, record)));
      // Both are always in the markup — `hidden lg:flex` / `lg:hidden` decide which one a reader
      // sees — so the two chrome marks are the floor this component owes on every brand. QuizHub
      // adds a third because its `categories` tile draws the same book (`STAT_MARKS`), which is
      // why the exact counts are pinned per brand below rather than here.
      expect(
        html.split(`lucide-${AUTH_MARKS_BY_BRAND[id].hero}`).length - 1,
        id,
      ).toBeGreaterThanOrEqual(2);
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
