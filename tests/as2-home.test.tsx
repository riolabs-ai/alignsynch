import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { As2HomeView } from "@/components/home/as2-home";
import { quizHubBrand } from "@/data/brand";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { alignSynchHomeAs2Copy } from "@/data/pages/home-alignsynch";
import { purchasableTypesByGroup } from "@/data/relationship-types";
import { as2Home } from "@/lib/home-alignsynch";

/**
 * The AS2 home page (#853) — the model, the rendered composition, and the three structural
 * promises the card said the page would keep.
 *
 * **What is *not* proved here.** Every word on the page comes from
 * `data/pages/home-alignsynch.ts` and every photograph from `data/media.ts`, and those two are
 * `pnpm data:check`'s job (`E23`'s budget of zero leaf literals on `components/home/**`, the media
 * registry's own rules, the fixture clock). This file proves the *join*: that the menu cannot
 * advertise a band the page does not emit, that the taxonomy is the source of the template chips
 * rather than a list typed beside them, and that the composition still mounts no chrome of its own.
 *
 * **Why a static render and not a browser.** The properties at risk are structural — one element
 * per anchor id, no second `<footer>`, the token paint on the wrapper — and each of them survives a
 * browser or dies in it identically. `renderToStaticMarkup` is what `tests/nav-brand.test.ts` uses
 * for the same reason: no jsdom, no hydration, no timing.
 */

/**
 * The page is joined against the **AlignSynch** record, not the ambient one. `data/brand.ts`'s
 * `brand` is resolved from `BRAND` at build time and the test process has no `BRAND`, so the ambient
 * value is QuizHub — whose record names none of the seven surface roles this page draws. Asking for
 * the page under it would be asking for a page the route never mounts, and `surfacePaint` refuses it
 * on purpose (asserted below).
 */
const model = as2Home(alignSynchBrand, alignSynchHomeAs2Copy);

/** How many times a literal appears in a string — used for "exactly one of these svg". */
function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("the in-page menu", () => {
  test("every row names a band this page emits", () => {
    const sectionIds = new Set((alignSynchHomeAs2Copy.sections ?? []).map((section) => section.id));

    expect(model.nav.items).toHaveLength(5);
    for (const item of model.nav.items) {
      expect(item.href.startsWith("#")).toBe(true);
      expect(sectionIds.has(item.href.slice(1))).toBe(true);
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  test("the five targets are the approved five, in the approved order", () => {
    expect(model.nav.items.map((item) => item.href)).toEqual([
      "#how-it-works",
      "#relationship-templates",
      "#questions",
      "#stories",
      "#benefits",
    ]);
  });

  test("the menu has an accessible name of its own", () => {
    // Two `aria-label`-less `<nav>`s on one page are announced as "navigation, navigation".
    expect(model.nav.name).toBe("On this page");
  });

  test("`#questions` survives — the shared header and footer link to it", () => {
    expect(model.nav.items.some((item) => item.href === "#questions")).toBe(true);
    expect(model.model.heading.length).toBeGreaterThan(0);
  });
});

describe("the template chips are the taxonomy", () => {
  test("both groups are drawn, in catalogue order", () => {
    const expected = purchasableTypesByGroup();

    expect(model.templates.groups.map((group) => group.group)).toEqual(
      expected.map((group) => group.group),
    );
    for (const [index, group] of model.templates.groups.entries()) {
      expect(group.types.map((type) => type.name)).toEqual(
        expected[index].types.map((type) => type.name),
      );
    }
  });

  test("every chip points at a relationship-type detail route, and no two at the same one", () => {
    const hrefs = model.templates.groups.flatMap((group) => group.types.map((type) => type.href));

    expect(hrefs.length).toBe(purchasableTypesByGroup().reduce((n, g) => n + g.types.length, 0));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) expect(href.startsWith("/relationship-types/")).toBe(true);
  });

  test("the two nested targets are the ones the hero cards jump to", () => {
    const groupIds = model.templates.groups.map((group) => group.id);

    for (const card of model.hero.cards) expect(groupIds).toContain(card.href.slice(1));
  });
});

describe("the ordered bands", () => {
  test("steps are numbered from their position, not from the fixture", () => {
    expect(model.howItWorks.steps.map((step) => step.number)).toEqual(["01", "02", "03", "04"]);
    expect(model.howItWorks.steps.every((step) => step.title && step.body)).toBe(true);
  });

  test("five benefits, each with a sentence — the reference's five (#904)", () => {
    // The approved page's `.benefit-list` is five rows in a two-column grid with the callout
    // spanning both. It was twelve rows of general wellbeing copy before #904; the count is the
    // reference's, so a row added or dropped is a red test rather than a taller band.
    expect(model.benefits.items).toHaveLength(5);
    for (const benefit of model.benefits.items) {
      expect(benefit.title.length).toBeGreaterThan(0);
      expect(benefit.body.length).toBeGreaterThan(0);
    }
    expect(model.benefits.callout.length).toBeGreaterThan(0);
  });

  test("three reflections, and the quote counts stay asymmetric", () => {
    // The asymmetry is the approved page's, and it is the fixture's to express: one card carries a
    // single quote, the other two carry a second (`-quote-alt`). A count assertion here is what
    // makes an accidental fourth quote a red test rather than a quietly taller card.
    expect(model.stories.cards.map((story) => story.quotes.length)).toEqual([1, 2, 2]);
    expect(model.stories.prompts.items).toHaveLength(4);
  });

  test("the model band's two cards carry a line grid each, and one panel apiece", () => {
    const [bread, butter] = model.model.cards;

    expect(model.model.cards).toHaveLength(2);
    expect(bread.lines.length).toBeGreaterThan(0);
    expect(butter.lines.length).toBeGreaterThan(0);
    // One card explains where a gap comes from, the other draws the scale — never both.
    expect([bread.note !== undefined, bread.scale !== undefined]).toEqual([true, false]);
    expect([butter.note !== undefined, butter.scale !== undefined]).toEqual([false, true]);
  });
});

describe("the brand the page needs", () => {
  test("the AlignSynch record names all seven surface roles", () => {
    expect(Object.keys(model.tokens).sort()).toEqual([
      "--deep",
      "--line",
      "--mark",
      "--mist",
      "--pale",
      "--paper",
      "--sand",
    ]);
  });

  test("a brand that names none is refused instead of rendering a blank band", () => {
    // QuizHub's record has no `mist`/`sand`/`mark`. Rendering it here would be a white page with
    // white text on a route that still builds — so the join refuses, and this is the assertion that
    // keeps the refusal.
    expect(() => as2Home(quizHubBrand, alignSynchHomeAs2Copy)).toThrow(/names no/);
  });
});

describe("the photographs", () => {
  const images = [
    ...model.hero.cards.map((card) => card.image),
    ...model.model.cards.map((card) => card.image),
  ];

  test("are local, registered, and carry an intrinsic size", () => {
    expect(images).toHaveLength(4);
    for (const image of images) {
      // `next/image` with no width/height is a 500 at request time while `next build` stays green.
      expect(image.width).toBeGreaterThan(0);
      expect(image.height).toBeGreaterThan(0);
      expect(image.src.startsWith("/home/")).toBe(true);
      expect(image.alt.length).toBeGreaterThan(12);
    }
  });

  test("exist on disk", () => {
    for (const image of images) {
      const path = join(process.cwd(), "public", image.src);
      expect(() => readFileSync(path)).not.toThrow();
    }
  });
});

describe("the composed page", () => {
  const html = renderToStaticMarkup(<As2HomeView model={model} />);

  test("every anchor id is emitted exactly once", () => {
    for (const item of model.nav.items) {
      expect(count(html, `id="${item.href.slice(1)}"`)).toBe(1);
    }
    for (const group of model.templates.groups) {
      expect(count(html, `id="${group.id}"`)).toBe(1);
    }
  });

  test("every anchor target carries the offset attribute", () => {
    // `data-home-anchor` is what `app/globals.css` matches to derive `scroll-margin-top`; an id
    // without it scrolls under both sticky bars.
    const targets = model.nav.items.length + model.templates.groups.length;
    expect(count(html, "data-home-anchor")).toBe(targets);
  });

  test("it mounts no chrome — the layout owns the header, the footer and the news band", () => {
    // The card's first "doomed if": a second header, footer or newsletter band on the page. The
    // composition cannot mount one, because it imports none — asserted below against the source.
    expect(count(html, "<footer")).toBe(0);
    // Every `<header>` in this render is a band's own `SectionHead` — three bands draw one — and the
    // shell's sticky header is not among them.
    expect(count(html, '<header class="mb-[38px]')).toBe(3);
    expect(count(html, "<header")).toBe(3);
  });

  test("the brand's surface roles are painted on the page, not on <html>", () => {
    expect(count(html, "home-anchors")).toBe(1);
    for (const role of ["paper", "mist", "sand", "line", "pale", "mark", "deep"]) {
      expect(html).toContain(`--${role}:`);
    }
    // Seven roles, seven declarations: a role added to the brand and not to the paint would leave
    // `bg-mist` resolving to nothing, which is a blank band rather than an error.
    expect(Object.keys(model.tokens)).toHaveLength(7);
  });

  test("the hero cards are one link each, and each names itself", () => {
    for (const card of model.hero.cards) {
      expect(html).toContain(`aria-label="${card.name}"`);
      expect(html).toContain(`href="${card.href}"`);
    }
  });

  test("business leads — the two hero cards are business then personal (#904)", () => {
    // The approved page opens on work and treats personal use as the secondary path. The order is
    // the projection's (the cards are a fixed pair), and the grid draws them left to right, so this
    // is the assertion that keeps the first card business the day someone "tidies" the array.
    expect(model.hero.cards.map((card) => card.id)).toEqual(["business", "personal"]);
    expect(html.indexOf('aria-label="Explore business relationship templates"')).toBeLessThan(
      html.indexOf('aria-label="Explore personal relationship templates"'),
    );
  });

  test("the counselor callout is drawn once, and only in the templates band", () => {
    // The brief allows exactly one bounded callout for counselors, therapists and coaches. Two is
    // the band becoming a practitioner pitch; none is the audience direction being dropped.
    expect(count(html, "For counselors, therapists, and coaches:")).toBe(1);
    expect(html).toContain(model.templates.counselor.rest);
  });
});

describe("the arrow glyph", () => {
  const html = renderToStaticMarkup(<As2HomeView model={model} />);

  test("every AS2 arrow carries its own box instead of resolving against the flex line", () => {
    // An `<svg>` with a `viewBox` and no `width`/`height` is sized by its container. Inside
    // `components/ui/button` the primitive supplies `[&_svg]:size-4`, but the hero's two raw anchors
    // are not buttons: before an explicit size existed on the glyph, the secondary CTA's arrow
    // resolved to 59.891px square and made a 14px text link a **123.906 × 60** box at every width
    // from `sm` up — 249.453px tall at 390, where the stacked column gave the glyph the whole 342px
    // width to resolve against. The measurements are in `docs/qa/home-comments/measurements.json`.
    //
    // The class is not always `size-4`: the reference draws the button arrow at 16px, the hero's
    // secondary link at 15px and the card footer at 14px. What must hold is that **every** arrow
    // carries a size of its own, so none can fall back to its container.
    const arrows = html.match(/class="([^"]*)"[^>]*viewBox="0 0 20 20"/g) ?? [];

    expect(arrows.length).toBeGreaterThan(0);
    expect(count(html, 'viewBox="0 0 20 20"')).toBe(arrows.length);
    for (const arrow of arrows) expect(arrow).toMatch(/class="[^"]*size-/);
  });

  test("the fix is the glyph's, and the secondary CTA keeps its 40px tap target", () => {
    // The card's "must not": no fixed height on the link. `min-h-10` is the 40px floor at 390 and
    // above that the link is exactly its own text line. The reference drops the floor at 740, which
    // is the breakpoint its own stylesheet uses — not `sm` (640).
    const hero = readFileSync(join(process.cwd(), "components/home/as2-hero.tsx"), "utf8");
    const secondary = hero.match(/inline-flex min-h-10[^"]*/)?.[0] ?? "";

    expect(secondary).toContain("min-h-10");
    expect(secondary).toContain("min-[741px]:min-h-0");
    expect(secondary).not.toMatch(/(^|\s)h-\d/);
  });
});

describe("the structural promises, read off the source", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  test("no AS2 component imports the shared chrome", () => {
    const files = [
      "components/home/as2-home.tsx",
      "components/home/as2-hero.tsx",
      "components/home/as2-section-nav.tsx",
      "components/home/as2-how-it-works.tsx",
      "components/home/as2-templates.tsx",
      "components/home/as2-model.tsx",
      "components/home/as2-stories.tsx",
      "components/home/as2-benefits.tsx",
      "components/home/as2-final-cta.tsx",
      "components/home/as2-parts.tsx",
    ];
    for (const file of files) {
      const source = read(file);
      for (const chrome of ["marketing-header", "layout/footer", "news-signup"]) {
        expect(source.includes(chrome)).toBe(false);
      }
    }
  });

  test("the anchor offset is derived from the header's declared height", () => {
    // The card's second "doomed if": an offset hard-coded in a section, so the first header-height
    // change breaks every anchor. One variable, one consumer.
    const globals = read("app/globals.css");
    const header = read("components/marketing/marketing-header.tsx");

    expect(globals).toContain("--site-header-height: 5rem;");
    expect(globals).toContain("var(--site-header-height)");
    // The header draws its row at `h-20`, which is 5rem — the two numbers are the same number.
    expect(header).toContain("h-20");
    expect(header.includes("h-[5rem]") || header.includes("h-20")).toBe(true);

    // And no section file carries a per-section magic number.
    for (const file of ["as2-how-it-works.tsx", "as2-templates.tsx", "as2-model.tsx"]) {
      expect(read(`components/home/${file}`)).toContain("data-home-anchor");
      expect(read(`components/home/${file}`).includes("scroll-mt-[")).toBe(false);
    }
  });

  test("the type scale is the reference's, not the component's own", () => {
    // A clone's failure mode is a "small improvement": 740 becomes 700 in one band, and the page is
    // subtly wrong everywhere that band repeats. These numbers are read out of the approved
    // stylesheet, so an edit to the reference fails here at the same moment it fails the design.
    const css = read("docs/specs/spec-design-page-rel-templates-v2/home/css/homepage-redesign.css");
    const hero = read("components/home/as2-hero.tsx");
    const parts = read("components/home/as2-parts.tsx");
    const stories = read("components/home/as2-stories.tsx");

    expect(css).toContain("font-size: clamp(42px, 5vw, 60px);");
    expect(css).toMatch(/\.hero h1 \{[^}]*font-weight: 760;/);
    expect(hero).toContain("text-[clamp(42px,5vw,60px)]");
    expect(hero).toContain("font-[760]");

    expect(css).toMatch(/h2\.section-title \{[^}]*font-weight: 740;/);
    expect(parts).toContain("font-[740]");

    expect(css).toMatch(/\.story-card h3 \{[^}]*font-weight: 720;/);
    expect(stories).toContain("font-[720]");

    // The reference's body ink is a hex with no role in the brand record; one constant, not fifteen.
    expect(css).toContain("--body: #59636e;");
    expect(parts).toContain('export const BODY_INK = "text-[#59636e]";');
  });
});
