/**
 * The sign-up form renders two steps and no quiz question (issue #291).
 *
 * `data/pages/register.ts` is proved by `tests/auth-copy.test.ts`; this file proves the *view*
 * that renders it, because the two halves can drift: the fixture can drop a section the
 * component still asks for (E23 catches that at build time), and the component can keep a
 * control the fixture no longer feeds (nothing catches that — the newsletter checkbox and the
 * interests grid were both live markup with no reader).
 *
 * It also pins the anchor that was wrong: the Terms and Privacy "links" on the last step
 * rendered `Link` from `lucide-react` — an icon — so the labels were drawn inside an `<svg>`
 * with `href` on the wrong element. A reader saw "I agree to the *" and no way to open either
 * document. The words are the fixture's; the element has to be `next/link`, and this is the
 * assertion that says so.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

import type { Brand } from "@/content/brand";
import { MARK_ICONS, RegisterView } from "@/components/auth/register-view";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { quizHubBrand } from "@/data/brand";
import { registerCopy } from "@/data/pages/register";
import { AUTH_MARKS_BY_BRAND } from "@/lib/auth/marks";
import { AFTER_SIGN_IN_BY_BRAND } from "@/lib/auth/paths";
import { registerCopyFor } from "@/lib/auth-copy";

const BRANDS = [
  ["quizhub", quizHubBrand as Brand],
  ["alignsynch", alignSynchBrand as Brand],
] as const;

/**
 * The three props the page hands the view in `app/(auth)/register/page.tsx`: `destination` (#351)
 * and `marks` (#225's pattern applied to the glyphs). The view is a client module, so the brand's
 * post-sign-in page and its marks arrive from the server exactly like the copy does.
 */
const viewProps = (id: (typeof BRANDS)[number][0], record: Brand) => ({
  copy: registerCopyFor(registerCopy(record), id),
  destination: AFTER_SIGN_IN_BY_BRAND[id],
  marks: AUTH_MARKS_BY_BRAND[id],
});

describe("the sign-up form on both brands", () => {
  it("opens on personal details, step 1 of 2", () => {
    for (const [id, record] of BRANDS) {
      const html = renderToStaticMarkup(createElement(RegisterView, viewProps(id, record)));
      expect(html, id).toContain("Step 1 of 2");
      expect(html, id).toContain("Personal Details");
      expect(html, id).toContain("First Name *");
      expect(html, id).toContain("Email *");
    }
  });

  it("asks no quiz question and offers no newsletter", () => {
    for (const [id, record] of BRANDS) {
      const html = renderToStaticMarkup(createElement(RegisterView, viewProps(id, record)));
      // The step's own words, the six buckets and the skill select are all gone from the view,
      // not just from the fixture — a fixture-only removal would leave the copy unreachable and
      // the controls still rendered.
      expect(html, id).not.toMatch(/quiz skill|quiz interest|interested in|newsletter/i);
      expect(html, id).not.toContain("Select your skill level");
      expect(html, id).not.toContain("General Knowledge");
    }
  });

  it("imports the anchor it draws, not the icon that shadows it", () => {
    // Step 2 is client state, so a static render never contains it: the regression guard for
    // the terms/privacy row is the import shape. `Link` used to come from `lucide-react`
    // (an SVG icon), which is why `<Link href="/terms">` rendered a `<svg>` with no label a
    // reader could see. The live page is checked by the card's own step-through on `next start`.
    const source = readFileSync(
      join(process.cwd(), "components/auth/register-view.tsx"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");

    expect(source).toMatch(/import\s+Link\s+from\s+"next\/link"/);
    const lucideImport = source.match(/import\s*\{([^}]*)\}\s*from\s*"lucide-react"/);
    expect(lucideImport, "the lucide import moved — update this guard").not.toBeNull();
    expect(lucideImport?.[1]).not.toMatch(/\bLink\b/);
  });

  it("draws this brand's marks, and no glyph a brand did not choose", () => {
    for (const [id, record] of BRANDS) {
      const html = renderToStaticMarkup(createElement(RegisterView, viewProps(id, record)));
      const marks = AUTH_MARKS_BY_BRAND[id];

      // The panel mark is server-rendered, so the served HTML is where the defect was visible:
      // a quiz book on the alignment build's sign-up page.
      expect(html, id).toContain(`lucide-${marks.hero}`);
      for (const other of BRANDS) {
        if (other[0] === id) continue;
        const foreign = AUTH_MARKS_BY_BRAND[other[0]];
        expect(html, `${id} must not draw ${other[0]}'s mark`).not.toContain(
          `lucide-${foreign.hero}`,
        );
      }
    }

    // The button mark only renders on step 2, which is client state a static render never reaches,
    // so the table is checked directly: every id a brand names has a glyph, and the glyph is the
    // `lucide-react` component that id names. A missing entry would render the button with no mark
    // at all rather than fail anything at build time.
    for (const [id] of BRANDS) {
      for (const markId of Object.values(AUTH_MARKS_BY_BRAND[id])) {
        const Icon = MARK_ICONS[markId];
        expect(
          Icon,
          `${id} names the mark "${markId}", which MARK_ICONS does not draw`,
        ).toBeDefined();
        const html = renderToStaticMarkup(createElement(Icon, { className: "w-4 h-4" }));
        expect(html, `${id} → ${markId}`).toContain(`lucide-${markId}`);
      }
    }
  });
});
