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
 *   2. outside the footer's brand-owned sections, it is the QuizHub render with the
 *      name and the address swapped — byte for byte — which is the stronger half: it proves
 *      the projection reads `brand.name` in exactly the places it prints the product name and
 *      nowhere else, so a reskin cannot drag copy with it.
 *
 * Claim 2 used to cover the whole projection, including the footer's blurb and the contact
 * block. Those are the brand's vocabulary now (#188, stage S3): the quiz build's footer
 * advertised "quizzes" and "quiz creators" on every page of the alignment build, because a
 * sentence about the product is not a string the name substitution can reach. They are excluded
 * from claim 2 and pinned separately below — the quiz side byte for byte, the alignment side
 * against the quiz vocabulary. The street line and the newsletter band those cases used to pin
 * are gone (#272): neither was a fact a brand could own.
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
import type { PageCopy } from "@/content/pages";
import { brand, quizHubBrand, resolveBrand } from "@/data/brand";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { media } from "@/data/media";
import { affiliatePageCopy } from "@/data/pages/affiliate";
import { homePageCopy, homeTitle } from "@/data/pages/home";
import { shellCopy, shellPageCopy } from "@/data/pages/shell";
import { itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { footerCopyFor } from "@/lib/shell-copy";

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
 * The second brand, local to this file so the projections can be called with it: the same
 * product, renamed. The record a build ships lives in `data/brands/alignsynch.ts`, and the
 * last describe block asserts the two are equal — so the shell proof below is a proof
 * about the skin the `BRAND=alignsynch` build renders, not about a test-only fixture.
 *
 * Its mark and its palette are the record's own, not restated here: both are derived — the
 * logo is a registered media path, the two accents are sampled out of the PNG and held to it
 * by `data:check`. A second copy of a sampled hex would be a second source of truth, which is
 * exactly what this test used to demonstrate.
 */
const alignSynch: Brand = zBrand.parse({
  name: "AlignSynch",
  legalName: "AlignSynch",
  description: alignSynchBrand.description,
  domain: "alignsynch.com",
  logo: alignSynchBrand.logo,
  // The tab icon is brand data like the logo (#187 stage 4): read from the record, not restated.
  icon: alignSynchBrand.icon,
  colors: alignSynchBrand.colors,
  supportEmail: "alignsynch@riolabs.ai",
  affiliateEmail: "alignsynch@riolabs.ai",
  referralBase: "https://alignsynch.com",
});

/**
 * The two records this file compares, each named explicitly.
 *
 * The pairs below are about *records*, not about the ambient `brand`: the gate's CI matrix builds
 * **and tests** under `BRAND=alignsynch` as well as `BRAND=quizhub`, and a "QuizHub" half that
 * quietly read the ambient record would assert the opposite of its own name in that lane. The
 * ambient record has its own tests: "exports today's shell as the QuizHub instance" and "resolves
 * the flag" below.
 */
const quizHubRender = render(shellCopy(quizHubBrand));
const alignSynchRender = render(shellCopy(alignSynch));

/**
 * The footer sections whose words are the brand's product vocabulary rather than a name or an
 * address (#188). They are the only part of the projection where the two brands' renders are
 * allowed to differ by more than the name and the mailbox — so they are the only part claim 2
 * below excludes, and each one is pinned explicitly in its own case. The newsletter pair left
 * this set with its section (#272).
 */
const BRAND_OWNED_FOOTER_SECTIONS = new Set([
  "footer-brand",
  "footer-brand-alignsynch",
  "footer-contact",
  "footer-contact-alignsynch",
]);

/** A projection's text with the brand-owned footer sections removed. */
function sharedRender(copy: PageCopy): string {
  return render({
    ...copy,
    sections: (copy.sections ?? []).filter(
      (section) => !BRAND_OWNED_FOOTER_SECTIONS.has(section.id),
    ),
  });
}

describe("shell projection — the product name comes from the brand", () => {
  it("renders the brand it was given", () => {
    expect(quizHubRender).toContain("QuizHub");
    expect(alignSynchRender).toContain("AlignSynch");
  });

  it("leaves no QuizHub in the AlignSynch render", () => {
    expect(alignSynchRender).not.toContain("QuizHub");
  });

  it("is the QuizHub render with the name and the address swapped, and nothing else", () => {
    expect(sharedRender(shellCopy(alignSynch))).toBe(
      sharedRender(shellCopy(quizHubBrand))
        .replaceAll("QuizHub", "AlignSynch")
        .replaceAll(quizHubBrand.supportEmail, alignSynch.supportEmail),
    );
  });

  /**
   * The three sentences #188 moved, pinned from both ends.
   *
   * The quiz build's wording is byte for byte what it shipped (that is the deploy-safety half:
   * a reskin must not move the template's copy), and the alignment build's carries none of the
   * quiz vocabulary that was being printed on a page with no quizzes in it. Both brands read
   * the same ids through `footerCopyFor`, which is what keeps the footer's three bands
   * addressable — a section that lost an id is a throw at render, not a blank line.
   */
  it("keeps the quiz build's footer wording exactly as shipped", () => {
    const footer = footerCopyFor(shellCopy(quizHubBrand), "quizhub");
    expect(sectionBody(footer.brand)).toBe(
      "Create engaging quizzes, challenge others, and earn rewards for your knowledge. Join our community of quiz creators and players today.",
    );
    expect(itemLabel(footer.contact, "cta")).toBe("Contact Support");
  });

  it("gives the alignment build footer words with no quiz vocabulary in them", () => {
    const footer = footerCopyFor(shellCopy(alignSynch), "alignsynch");
    const words = render(footer);
    expect(words.length).toBeGreaterThan(0);
    expect(words).not.toMatch(/\bquiz/i);
    // The strings #188 was filed on, named so a regression says which one came back.
    expect(words).not.toContain("quiz creators");
    expect(words).not.toContain("quiz tips");
    expect(words).not.toContain("Quiz Street");
    // Same ids, different words: the footer resolves one set of ids per brand.
    for (const id of ["email", "cta"]) {
      expect(itemLabel(footer.contact, id).length).toBeGreaterThan(0);
    }
  });

  it("prints the record's support address in every block that prints one", () => {
    // The header's account block used to be one of these (`display-email`) — it printed the
    // brand's support mailbox as if it were the signed-in person's own address. Since #212 that
    // block prints the session's address, so the two footer bands are the blocks that print one.
    const blocks: { section: string; id: string }[] = [
      { section: "footer-contact", id: "email" },
      { section: "footer-contact-alignsynch", id: "email" },
    ];
    for (const block of blocks) {
      expect(itemLabel(sectionOf(shellPageCopy, block.section), block.id)).toBe(brand.supportEmail);
    }
    expect(render(shellPageCopy)).not.toContain("info@");
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
    const quizHubFaq = render(pricingFaqCategories(quizHubBrand));
    const alignSynchFaq = render(pricingFaqCategories(alignSynch));
    expect(quizHubFaq).toContain("What is QuizHub?");
    expect(alignSynchFaq).toContain("What is AlignSynch?");
    expect(alignSynchFaq).not.toContain("QuizHub");
    expect(alignSynchFaq).toBe(
      quizHubFaq
        .replaceAll("QuizHub", "AlignSynch")
        .replaceAll(quizHubBrand.supportEmail, alignSynch.supportEmail),
    );
  });

  it("renders the support FAQ as the product it names", () => {
    // `supportFaqGroups` takes the brand id, not a record: the rows and the name cannot
    // disagree, so the pair to prove is the two ids' renders, not a record handed in.
    const alignSynchFaq = render(supportFaqGroups("alignsynch"));
    const quizHubFaq = render(supportFaqGroups("quizhub"));
    expect(alignSynchFaq).toContain("AlignSynch");
    expect(alignSynchFaq).not.toContain("QuizHub");
    expect(alignSynchFaq).not.toContain(quizHubBrand.supportEmail);
    expect(quizHubFaq).toContain("QuizHub");
    expect(quizHubFaq).not.toContain("AlignSynch");
  });
});

describe("the brand record", () => {
  it("points `logo` at a file the media registry already carries", () => {
    const srcs = Object.values(media).flatMap((entry) => ("src" in entry ? [entry.src] : []));
    expect(srcs).toContain(brand.logo);
    // Both records, because the skin's mark is a real file now and not the template's
    // placeholder: `data:check` E18 proves the registry matches `public/`, this proves the
    // record points at it.
    for (const record of [quizHubBrand, alignSynchBrand]) {
      expect(srcs).toContain(record.logo);
    }
  });

  it("carries the values the app paints with today", () => {
    // The default record, named explicitly: these are QuizHub's own values, painted onto
    // `<html>` inline by `lib/brand-theme.ts`, which is the same fact in either build lane.
    expect(quizHubBrand.name).toBe("QuizHub");
    expect(quizHubBrand.domain).toBe("quizhub.com");
    expect(quizHubBrand.supportEmail).toBe("quizhub@riolabs.ai");
    // The record's colours, resolved out of `hsl(var(--token))` rather than left as references.
    expect(quizHubBrand.colors.primary).toBe("hsl(0 0% 9%)");
    expect(quizHubBrand.colors.background).toBe("hsl(0 0% 100%)");
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

describe("the two affiliate strings are fields, not literals", () => {
  it("carries the partner inbox and the referral origin on the record", () => {
    expect(quizHubBrand.affiliateEmail).toBe("quizhub@riolabs.ai");
    expect(quizHubBrand.referralBase).toBe("https://quizhub.com");
    // The origin, not a link: the path and the handle belong to the component.
    expect(quizHubBrand.referralBase).not.toContain("/ref");
  });

  it("prints the record's affiliate address in the /affiliate closing CTA", () => {
    const cta = sectionOf(affiliatePageCopy, "affiliate-cta");
    expect(itemLabel(cta, "contact-email")).toBe(brand.affiliateEmail);
    // One address, read from the record: a second copy in the fixture is a second
    // source of truth, and the build grep cannot tell the two apart.
    expect(render(affiliatePageCopy).split(brand.affiliateEmail).length - 1).toBe(1);
  });

  it.each([
    ["a path", "https://quizhub.com/ref"],
    ["a trailing slash", "https://quizhub.com/"],
    ["a username", "https://me@example.com"],
    ["a query", "https://quizhub.com?ref=1"],
    ["a fragment", "https://quizhub.com#ref"],
    ["no scheme", "quizhub.com"],
  ])("rejects a referral base with %s", (_kind, value) => {
    expect(() => zBrand.parse({ ...brand, referralBase: value })).toThrow(/must be an origin/);
  });

  it("rejects an affiliate address that is not an email", () => {
    expect(() => zBrand.parse({ ...brand, affiliateEmail: "affiliates at quizhub" })).toThrow();
  });
});

describe("one build flag, one brand", () => {
  it("ships the AlignSynch record as a second Brand on its own domain", () => {
    expect(alignSynchBrand.name).toBe("AlignSynch");
    expect(alignSynchBrand.domain).toBe("alignsynch.com");
    expect(alignSynchBrand.supportEmail).toBe("alignsynch@riolabs.ai");
    expect(alignSynchBrand.affiliateEmail).toBe("alignsynch@riolabs.ai");
    expect(alignSynchBrand.referralBase).toBe("https://alignsynch.com");
    // The shell proof above runs on a fixture; this is that fixture, so the proof is
    // about the record the `BRAND=alignsynch` build actually renders.
    expect(alignSynchBrand).toEqual(alignSynch);
  });

  it("gives each brand its own document description", () => {
    // `app/layout.tsx` prints `brand.description` as the document head's meta description, so
    // the AlignSynch build must stop advertising the quiz product in the tag no page overrides
    // on `/`. QuizHub's value is the exact string the tree rendered before the field existed,
    // pinned byte for byte so the template build's head does not move; AlignSynch's carries no
    // quiz vocabulary at all.
    expect(quizHubBrand.description).toBe(
      "Create quizzes, play games, and earn money with our multi-vendor quiz platform",
    );
    expect(alignSynchBrand.description).toBe(
      "AlignSynch asks two people the same five questions about their relationship, once for how it is now and once for how each of them wishes it to be, and shows where the answers differ.",
    );
    expect(alignSynchBrand.description).not.toMatch(/\bquiz/i);
  });

  it("owns its palette and its mark, sampled from its own logo", () => {
    // The skin stopped borrowing the template's: the two accents are the logo's, and the
    // mark is a real file. The *values* are pinned against the PNG by
    // `scripts/sample-brand-colors.mjs --check`, so this only asserts the relationship.
    expect(alignSynchBrand.colors.primary).not.toBe(quizHubBrand.colors.primary);
    expect(alignSynchBrand.colors.accent).not.toBe(quizHubBrand.colors.accent);
    expect(alignSynchBrand.logo).not.toBe(quizHubBrand.logo);
    expect(alignSynchBrand.colors.primary).toMatch(/^#[0-9a-f]{6}$/);
    expect(alignSynchBrand.colors.accent).toMatch(/^#[0-9a-f]{6}$/);
    // The card's decisions, which are not samples: the ground is white because the mark is
    // black ink on white (#157), the ink is the marketing slate, and the type stays Inter
    // (there is no font field to check).
    expect(alignSynchBrand.colors.background).toBe("#ffffff");
    expect(alignSynchBrand.colors.foreground).toBe("#363d49");
  });

  it("keeps the mailbox off the site domain, on purpose", () => {
    // Decided 2026-10-30: the templates answer at `@riolabs.ai` while each brand claims its
    // own site domain. An address derived from `domain` would invent an unread mailbox, so
    // this pins the two records' behaviour rather than the strings.
    for (const record of [quizHubBrand, alignSynchBrand]) {
      expect(record.supportEmail.endsWith("@riolabs.ai")).toBe(true);
      expect(record.affiliateEmail.endsWith("@riolabs.ai")).toBe(true);
      expect(record.supportEmail.endsWith(`@${record.domain}`)).toBe(false);
    }
  });

  it("resolves the flag, defaulting to QuizHub", () => {
    expect(resolveBrand(undefined)).toBe(quizHubBrand);
    expect(resolveBrand("")).toBe(quizHubBrand);
    expect(resolveBrand("quizhub")).toBe(quizHubBrand);
    expect(resolveBrand("alignsynch")).toBe(alignSynchBrand);
    // `brand` is this process's build constant, so it follows the ambient flag. Both lanes of the
    // CI matrix run this file (#171): with `BRAND=alignsynch` the module must resolve that record,
    // and with the flag unset it must still be QuizHub — which is the default the three lines above
    // pin by name.
    expect(brand).toBe(process.env.BRAND === "alignsynch" ? alignSynchBrand : quizHubBrand);
  });

  it("refuses a brand it does not know instead of rendering a half-swapped tree", () => {
    expect(() => resolveBrand("acme")).toThrow(/BRAND=acme is not a brand/);
  });
});
