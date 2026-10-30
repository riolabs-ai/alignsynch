/**
 * The shell is a function of the brand, not of a spelling.
 *
 * The failure this pins: `data/pages/shell.ts` used to write the product name as copy
 * (`heading: "QuizHub"`, and the same word inside the copyright line), so "this demo is
 * AlignSynch now" was a find-and-replace across the tree and a second skin was a second
 * copy of every page. With the brand as a record, the shell projection is `shellCopy(brand)`
 * and a different record must render a different product name with nothing else moving.
 *
 * So the two claims are pairs, in this file:
 *
 *   1. the AlignSynch render says AlignSynch and does not say QuizHub;
 *   2. it is the QuizHub render with the name swapped — byte for byte — which is the
 *      stronger half: it proves the projection reads `brand.name` in exactly the places
 *      it prints the product name and nowhere else, so a reskin cannot drag copy with it.
 *
 * "Renders" here means the projection's own text: a `PageCopy` is words with no markup,
 * the components that draw it get it as a prop, and a node environment has no DOM. Every
 * string the projection carries is collected in declaration order instead — if a string
 * reaches the screen, it is in this walk.
 *
 * The three surfaces below are the ones a second brand must change end to end: the shell
 * (chrome on every page), the `/` title (the tab), and the pricing FAQ (a sentence that
 * spells the product's name and prints its support address). Every other literal in
 * `app/`, `components/` and `data/` reads the same record; the shell's two addresses now
 * read `brand.supportEmail` rather than a demo literal, which is why the AlignSynch render
 * swaps the address as well as the name.
 */
import { describe, expect, it } from "vitest";

import { pricingFaqCategories } from "@/components/pricing/pricing-faq";
import { supportFaqGroups } from "@/components/support/support-faq";
import { zBrand, type Brand } from "@/content/brand";
import { brand } from "@/data/brand";
import { media } from "@/data/media";
import { homePageCopy, homeTitle } from "@/data/pages/home";
import { shellCopy, shellPageCopy } from "@/data/pages/shell";

/** Every string a projection carries, in the order it declares them. */
function render(value: unknown): string {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const entry of node) walk(entry);
      return;
    }
    if (node && typeof node === "object") {
      for (const entry of Object.values(node)) walk(entry);
    }
  };
  walk(value);
  return out.join("\n");
}

/**
 * The second brand: the same product, renamed. A fixture and not a second `data/` module —
 * the card after this one builds the skin, and this record exists to prove the projection
 * reads the field rather than to ship AlignSynch.
 */
const alignSynch: Brand = zBrand.parse({
  name: "AlignSynch",
  legalName: "AlignSynch",
  domain: "alignsynch.com",
  logo: brand.logo,
  colors: brand.colors,
  supportEmail: "support@alignsynch.com",
});

const quizHubRender = render(shellPageCopy);
const alignSynchRender = render(shellCopy(alignSynch));

describe("shell projection — the product name comes from the brand", () => {
  it("renders the brand it was given", () => {
    expect(quizHubRender).toContain("QuizHub");
    expect(alignSynchRender).toContain("AlignSynch");
  });

  it("leaves no QuizHub in the AlignSynch render", () => {
    expect(alignSynchRender).not.toContain("QuizHub");
  });

  it("is the QuizHub render with the name and the address swapped, and nothing else", () => {
    expect(alignSynchRender).toBe(
      quizHubRender
        .replaceAll("QuizHub", "AlignSynch")
        .replaceAll(brand.supportEmail, alignSynch.supportEmail),
    );
  });

  it("prints the record's support address in both of the shell's addresses", () => {
    const rendered = render(shellPageCopy);
    expect(rendered.split(brand.supportEmail).length - 1).toBe(2);
    expect(rendered).not.toContain("info@quizhub.com");
  });

  it("exports today's shell as the QuizHub instance", () => {
    expect(shellPageCopy).toEqual(shellCopy(brand));
    expect(shellPageCopy.heading).toBe(brand.name);
  });
});

describe("the home title and one FAQ read the same record", () => {
  it("builds the / title from the brand word in front of the route's tagline", () => {
    expect(homeTitle(brand)).toBe(`${brand.name} — Play, Share, Earn`);
    expect(homeTitle(alignSynch)).toBe("AlignSynch — Play, Share, Earn");
    // The route's own copy never spelled the product name; the title was the only literal.
    expect(render(homePageCopy)).not.toContain("QuizHub");
  });

  it("renders the pricing FAQ in the brand it was given", () => {
    const quizHubFaq = render(pricingFaqCategories(brand));
    const alignSynchFaq = render(pricingFaqCategories(alignSynch));
    expect(quizHubFaq).toContain("What is QuizHub?");
    expect(alignSynchFaq).toContain("What is AlignSynch?");
    expect(alignSynchFaq).not.toContain("QuizHub");
    expect(alignSynchFaq).toBe(
      quizHubFaq
        .replaceAll("QuizHub", "AlignSynch")
        .replaceAll(brand.supportEmail, alignSynch.supportEmail),
    );
  });

  it("renders the support FAQ as the brand it was given", () => {
    const alignSynchFaq = render(supportFaqGroups(alignSynch));
    expect(alignSynchFaq).toContain("AlignSynch");
    expect(alignSynchFaq).not.toContain("QuizHub");
    expect(alignSynchFaq).not.toContain(brand.supportEmail);
  });
});

describe("the brand record", () => {
  it("points `logo` at a file the media registry already carries", () => {
    const srcs = Object.values(media).map((entry) => entry.src);
    expect(srcs).toContain(brand.logo);
  });

  it("carries the values the app paints with today", () => {
    expect(brand.name).toBe("QuizHub");
    expect(brand.domain).toBe("quizhub.com");
    expect(brand.supportEmail).toBe("support@quizhub.com");
    // `styles/globals.css` :root, resolved out of `hsl(var(--token))`.
    expect(brand.colors.primary).toBe("hsl(0 0% 9%)");
    expect(brand.colors.background).toBe("hsl(0 0% 100%)");
  });

  it("rejects a token name where a colour belongs", () => {
    expect(() =>
      zBrand.parse({ ...brand, colors: { ...brand.colors, primary: "indigo" } }),
    ).toThrow(/must be a CSS colour/);
  });

  it("rejects a logo path that is not public-rooted", () => {
    expect(() => zBrand.parse({ ...brand, logo: "logo.svg" })).toThrow(/public-rooted image path/);
  });

  it("rejects a domain that carries a scheme", () => {
    expect(() => zBrand.parse({ ...brand, domain: "https://quizhub.com" })).toThrow(
      /bare lowercase host/,
    );
  });

  it("rejects a field it does not define", () => {
    expect(() => zBrand.parse({ ...brand, tagline: "Quiz harder" })).toThrow();
  });
});
