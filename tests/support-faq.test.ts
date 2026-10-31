/**
 * The support FAQ answers in each product's own words, and names only its own destinations.
 *
 * `/support` had one set of rows for two products, and the `general` pair was the quiz product's:
 * "What is AlignSynch?" sent a reader to `/explore` and `/create/editor`, "How do I get started?"
 * added `/creator-tips` — three routes `product.quiz-surfaces` answers 404 for on that build (#300),
 * and a product that does not take quizzes at all. A support page that instructs a reader into a
 * 404 is the same defect as #309's fabricated articles: a claim about a product this build is not.
 *
 * The rows are now two writers behind one `Record<BrandId, …>` table, so these cases hold the four
 * things that were true by accident and are now checked:
 *
 *   per product   each build's rows answer exactly the categories its own taxonomy offers — no
 *                 category offered with nothing behind it, no rows under a category it does not
 *                 offer (`data/support-categories.ts` is the authority for "offers");
 *   no borrowed vocabulary  the alignment build names no catalogue, editor, creator tips, quiz,
 *                 tournament or subscription, in any row, question or answer;
 *   resolvable    every route a row prints is a page file this tree carries, and on the alignment
 *                 build it is not one `tests/parity/boundary.ts` closes;
 *   unchanged     QuizHub's ten rows are still its own, verbatim — the quiz build is not the build
 *                 this card changes.
 *
 * The routes are read out of the answer text rather than from a list in this file, because the
 * failure mode is textual: a sentence is where a dead destination hides.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  supportFaqGroups,
  supportFaqRowsByBrand,
  type SupportFaqRows,
} from "@/components/support/support-faq";
import type { BrandId } from "@/data/brand";
import { supportCategoriesByBrand } from "@/data/support-categories";

/** The products the tree ships, as `BRAND` names them. */
const brandIds: readonly BrandId[] = ["quizhub", "alignsynch"];
type BrandKey = (typeof brandIds)[number];

/** The rows `/support` renders on that build: the "all" tab's flatten, in taxonomy order. */
function rendered(brandId: BrandKey): SupportFaqRows[keyof SupportFaqRows] {
  const rows = supportFaqGroups(brandId);
  return supportCategoriesByBrand[brandId].flatMap((id) => rows[id]);
}

/** Every word the build renders, question and answer, as one string to search. */
function textOf(brandId: BrandKey): string {
  return rendered(brandId)
    .map((row) => `${row.question} ${row.answer}`)
    .join("\n");
}

/** Every route a row prints — `/explore`, `/create/editor`, `/settings` — deduplicated. */
function routesNamed(brandId: BrandKey): string[] {
  const found = textOf(brandId).match(/(?:^|[\s(])\/[a-z][a-z0-9-]*(?:\/[a-z0-9-]+)*/g) ?? [];
  return [...new Set(found.map((match) => match.trim().replace(/^\(/, "")))];
}

/**
 * The routes the quiz product owns, read from the parity boundary's own list (#300) rather than
 * copied here: `tests/parity/boundary.ts` is the authority on which routes one product ships and
 * the other does not, and a second copy is a second list to forget.
 *
 * Read as source text on purpose. Importing the module evaluates twenty-two page modules, and this
 * is a claim about strings, not about renders.
 */
function quizOnlyRoutes(): string[] {
  const path = fileURLToPath(new URL("./parity/boundary.ts", import.meta.url));
  const source = readFileSync(path, "utf8");
  return [...source.matchAll(/route: "([^"]+)"/g)].map((match) => match[1]);
}

/** Does `route` name `pattern`, or a page under it? (`/quiz` covers `/quiz/[id]`.) */
function covers(pattern: string, route: string): boolean {
  const bare = pattern.replace(/\/\[[^\]]+\]/g, "");
  return route === bare || route.startsWith(`${bare}/`);
}

describe("the support FAQ is per product", () => {
  it("answers each build's own taxonomy: no empty category offered, no rows it does not offer", () => {
    for (const brandId of brandIds) {
      const offered = new Set<string>(supportCategoriesByBrand[brandId]);
      const rows = supportFaqGroups(brandId);

      for (const category of offered) {
        expect(
          rows[category as keyof SupportFaqRows].length,
          `${brandId} offers "${category}" with no answer behind it — an empty panel`,
        ).toBeGreaterThan(0);
      }

      for (const [category, list] of Object.entries(rows)) {
        if (list.length === 0) continue;
        expect(
          offered.has(category),
          `${brandId} answers "${category}" rows it does not offer in its rail`,
        ).toBe(true);
      }
    }
  });

  it("has a writer for every brand and no brand without one", () => {
    expect(Object.keys(supportFaqRowsByBrand).sort()).toEqual([...brandIds].sort());
  });

  it("leaves the quiz build's ten rows verbatim", () => {
    expect(rendered("quizhub").map((row) => row.question)).toEqual([
      "How do I edit my profile?",
      "Can I change my username?",
      "Who can see my profile?",
      "How do I write a quiz?",
      "What kinds of questions can a quiz have?",
      "What does the app store about me?",
      "A page looks out of date, or a button does nothing. What should I try?",
      "What is QuizHub?",
      "How do I get started?",
      "How do I contact support?",
    ]);

    // The quiz product's own words, because these routes answer on that build: this card must not
    // quietly rewrite the product it is not about.
    const quizText = textOf("quizhub");
    for (const route of ["/explore", "/create/editor", "/creator-tips"]) {
      expect(quizText, `QuizHub's rows stopped naming ${route}`).toContain(route);
    }
  });

  it("keeps the quiz product's vocabulary off the alignment build", () => {
    const aligned = textOf("alignsynch");

    for (const route of ["/explore", "/create/editor", "/creator-tips"]) {
      expect(aligned, `the alignment FAQ sends a reader to ${route}`).not.toContain(route);
    }
    for (const word of [
      /\bquiz(?:zes)?\b/i,
      /\btournaments?\b/i,
      /\bsubscriptions?\b/i,
      /\bbilling\b/i,
      /\bpremium\b/i,
      /\bcreator tips?\b/i,
    ]) {
      expect(aligned, `the alignment FAQ says ${word}`).not.toMatch(word);
    }
  });

  it("names only destinations that answer on the build it renders", () => {
    const gated = quizOnlyRoutes();
    // The list was parsed, not silently empty: these three are the rows this card is about.
    for (const route of ["/explore", "/create/editor", "/creator-tips"]) {
      expect(gated, `boundary.ts no longer lists ${route}`).toContain(route);
    }

    for (const brandId of brandIds) {
      for (const route of routesNamed(brandId)) {
        const page = [`app/(mainlayout)${route}/page.tsx`, `app/(auth)${route}/page.tsx`];
        expect(
          page.some((file) => existsSync(fileURLToPath(new URL(`../${file}`, import.meta.url)))),
          `${brandId}'s FAQ names ${route}, which is no page in this tree`,
        ).toBe(true);

        if (brandId !== "alignsynch") continue;
        const closed = gated.find((pattern) => covers(pattern, route));
        expect(closed, `the alignment FAQ names ${route}, closed by product.quiz-surfaces`).toBe(
          undefined,
        );
      }
    }
  });
});
