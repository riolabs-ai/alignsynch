/**
 * The 404's brand-selected copy (#351 follow-up).
 *
 * `app/not-found.tsx` is rendered by both builds — it is what a dead link, a route the other
 * product owns and a typed address all reach — and until this module it printed QuizHub's words on
 * both: "Oops! Quiz Not Found", quiz masters, an emoji. On AlignSynch that is quiz vocabulary in a
 * product that sells assessments (#188), shown at the moment the product had already failed, and it
 * is the first error page a new customer can see.
 *
 * The projection is the same one `lib/auth-copy.ts` applies to `/login` and `/register`: the
 * fixture (`data/pages/not-found.ts`) carries a brand-suffixed section beside each shared one, this
 * module picks the set, and the page resolves **one contract of ids** (`message`, `fact`,
 * `actions`, plus the page-level `heading`) whichever build it is. So the view never learns which
 * brand it renders and never holds a sentence.
 *
 * `never` on the default is the point of the `switch`: a third brand fails `tsc` here until somebody
 * writes its 404 deliberately, instead of inheriting one product's error page the way this defect
 * happened.
 */
import type { PageCopy, PageCopySection } from "@/content/pages";
import type { BrandId } from "@/data/brand";
import { sectionOf } from "./page-copy";

/**
 * One page copy out of the brand's four pieces.
 *
 * `heading` arrives separately because it is a page-level field on `PageCopy` (the surface's hero
 * line), not a band — a brand-suffixed section carries it and this function moves it up, naming the
 * ids the view resolves so the two fixtures cannot disagree about them.
 */
function notFoundPage(
  parts: {
    heading: string | undefined;
    message: PageCopySection;
    fact: PageCopySection;
    actions: PageCopySection;
  },
  brand: string,
): PageCopy {
  if (parts.heading === undefined) {
    throw new Error(
      `PageCopy: the ${brand} 404 has no heading — the page renders it as the h2, so a fixture without one draws an empty error card`,
    );
  }
  return {
    heading: parts.heading,
    sections: [
      { ...parts.message, id: "message" },
      { ...parts.fact, id: "fact" },
      { ...parts.actions, id: "actions" },
    ],
  };
}

/** The 404 this build renders. */
export function notFoundCopyFor(copy: PageCopy, brandId: BrandId): PageCopy {
  switch (brandId) {
    case "quizhub":
      return notFoundPage(
        {
          heading: copy.heading,
          message: sectionOf(copy, "message"),
          fact: sectionOf(copy, "fact"),
          actions: sectionOf(copy, "actions"),
        },
        brandId,
      );
    case "alignsynch":
      return notFoundPage(
        {
          heading: sectionOf(copy, "hero-alignsynch").heading,
          message: sectionOf(copy, "message-alignsynch"),
          fact: sectionOf(copy, "fact-alignsynch"),
          actions: sectionOf(copy, "actions-alignsynch"),
        },
        brandId,
      );
    default: {
      // A brand added to `data/brand.ts` without a 404 lands here and fails `tsc`.
      const unhandled: never = brandId;
      throw new Error(`no 404 copy for brand ${String(unhandled)}`);
    }
  }
}
