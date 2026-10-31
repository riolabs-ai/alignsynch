/**
 * The support taxonomy is one table, and a build renders its own row (#313).
 *
 * The contact form's category `<SelectItem>`s used to be written by hand, one per id, and offered
 * `billing` and `tournaments` on both builds while the rail offered neither — so the alignment
 * product's contact form listed a category it does not sell and no surface could answer. The list
 * is now `data/support-categories.ts`, the same value the rail reads, and these cases hold the
 * three things that used to drift:
 *
 *   resolvable  every id any brand offers is an item in `data/pages/support.ts`, so `itemLabel`
 *               cannot throw at request time;
 *   per product the alignment row has no quiz category, and neither row has billing or tournaments;
 *   no orphans  every id left in the fixture is offered by at least one build, so a retired name
 *               does not sit in the copy waiting to be re-offered by mistake.
 */
import { describe, expect, it } from "vitest";

import { brand, brandIdOf } from "@/data/brand";
import { supportPageCopy } from "@/data/pages/support";
import {
  SUPPORT_FAQ_CATEGORIES,
  supportCategories,
  supportCategoriesByBrand,
  supportCategoriesFor,
} from "@/data/support-categories";
import { sectionOf } from "@/lib/page-copy";

const fixtureIds = (sectionOf(supportPageCopy, "help-categories").items ?? []).map(
  (item) => item.id,
);

describe("the support category taxonomy is per build", () => {
  it("offers only categories the copy fixture can name", () => {
    for (const [brandId, list] of Object.entries(supportCategoriesByBrand)) {
      for (const id of list) {
        expect(fixtureIds, `${brandId} offers "${id}" with no label in the fixture`).toContain(id);
      }
    }
  });

  it("gives the alignment product no quiz category, and neither product billing or tournaments", () => {
    expect(supportCategoriesFor("alignsynch")).toEqual([
      "account",
      "privacy",
      "technical",
      "general",
    ]);
    expect(supportCategoriesFor("quizhub")).toEqual([
      "account",
      "quiz-creation",
      "privacy",
      "technical",
      "general",
    ]);

    const offered = Object.values(supportCategoriesByBrand).flat();
    expect(offered).not.toContain("billing");
    expect(offered).not.toContain("tournaments");
  });

  it("resolves the build's own row, and the union is the categories the FAQ answers", () => {
    expect(supportCategories).toEqual(supportCategoriesFor(brandIdOf(brand)));
    expect(SUPPORT_FAQ_CATEGORIES).toEqual(supportCategoriesFor("quizhub"));
  });

  it("leaves no fixture category that no build offers", () => {
    const offered = new Set<string>(Object.values(supportCategoriesByBrand).flat());
    for (const id of fixtureIds) {
      if (id === "all") continue;
      expect(offered.has(id), `"${id}" has a label but no build offers it`).toBe(true);
    }
  });
});
