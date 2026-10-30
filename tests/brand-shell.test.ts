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
import { brand, quizHubBrand, resolveBrand } from "@/data/brand";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { media } from "@/data/media";
import { affiliatePageCopy } from "@/data/pages/affiliate";
import { homePageCopy, homeTitle } from "@/data/pages/home";
import { shellCopy, shellPageCopy } from "@/data/pages/shell";
import { itemLabel, sectionOf } from "@/lib/page-copy";

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
 */
const alignSynch: Brand = zBrand.parse({
  name: "AlignSynch",
  legalName: "AlignSynch",
  domain: "alignsynch.com",
  logo: brand.logo,
  colors: brand.colors,
  supportEmail: "alignsynch@riolabs.ai",
  affiliateEmail: "alignsynch@riolabs.ai",
  referralBase: "https://alignsynch.com",
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
    expect(rendered).not.toContain("info@");
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
    const srcs = Object.values(media).flatMap((entry) => ("src" in entry ? [entry.src] : []));
    expect(srcs).toContain(brand.logo);
  });

  it("carries the values the app paints with today", () => {
    expect(brand.name).toBe("QuizHub");
    expect(brand.domain).toBe("quizhub.com");
    expect(brand.supportEmail).toBe("quizhub@riolabs.ai");
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

describe("the two affiliate strings are fields, not literals", () => {
  it("carries the partner inbox and the referral origin on the record", () => {
    expect(brand.affiliateEmail).toBe("quizhub@riolabs.ai");
    expect(brand.referralBase).toBe("https://quizhub.com");
    // The origin, not a link: the path and the handle belong to the component.
    expect(brand.referralBase).not.toContain("/ref");
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
    expect(brand).toBe(quizHubBrand);
  });

  it("refuses a brand it does not know instead of rendering a half-swapped tree", () => {
    expect(() => resolveBrand("acme")).toThrow(/BRAND=acme is not a brand/);
  });
});
