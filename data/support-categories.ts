/**
 * Which support categories a build offers — the brand-aware half of `/support`'s taxonomy (#288).
 *
 * The route had one taxonomy and two products. `SUPPORT_FAQ_CATEGORIES` (#288) pruned the FAQ to
 * the categories this tree answers, and `support-categories.tsx` derives the rail from it — but
 * the contact form's `<SelectItem>` list was written separately and still offered `billing` and
 * `tournaments`, which no FAQ row and no article answers on either build. Under the alignment
 * brand that read as products AlignSynch does not sell: it has no tournaments, and it has no
 * billing surface.
 *
 * So the list is a **table**, `Record<BrandId, …>`, the same shape `data/knowledge-base.ts` uses
 * for articles: a third brand fails `tsc` until somebody decides what its support surface says,
 * instead of silently inheriting the quiz product's words.
 *
 *   quizhub      account, quiz-creation, privacy, technical, general — the FAQ answers all five
 *   alignsynch   account, privacy, technical, general — no quiz product, so no quiz category
 *
 * `billing` and `tournaments` are in neither list, on either build. They are `SupportCategory`
 * members in `content/article.ts` because the article fixtures carry a slug in each, and that
 * union is not this file's to narrow; what they lost is the last surface that offered them, which
 * also retired their `help-categories` labels.
 *
 * The rule the rail and the select share: a category with no rows behind it cannot be selectable.
 * Adding a name here without a `supportFaqGroups` entry is an empty panel; adding one here that
 * the build has no articles for is a category whose Knowledge Base tab is empty (alignsynch's
 * privacy and technical are that case today — the fix is an article, not a fourth list).
 */
import type { SupportCategory } from "../content/article";
import { brand, brandIdOf, type BrandId } from "./brand";

/** The categories QuizHub's support surface answers, in rail order. */
export const SUPPORT_FAQ_CATEGORIES = [
  "account",
  "quiz-creation",
  "privacy",
  "technical",
  "general",
] as const;

/** A category with FAQ rows behind it. Every brand's list is a subset of this union. */
export type SupportFaqCategory = (typeof SUPPORT_FAQ_CATEGORIES)[number];

/**
 * The taxonomy, per product. A brand's list is typed as the union above, so a name that no FAQ
 * answers fails `tsc` before it can render an empty panel.
 */
export const supportCategoriesByBrand: Readonly<Record<BrandId, readonly SupportFaqCategory[]>> = {
  quizhub: SUPPORT_FAQ_CATEGORIES,
  alignsynch: ["account", "privacy", "technical", "general"],
};

/** The categories one build offers, for a caller that holds the id rather than the record. */
export function supportCategoriesFor(brandId: BrandId): readonly SupportFaqCategory[] {
  return supportCategoriesByBrand[brandId];
}

/**
 * The list **this build** offers — the one value the rail, the contact select and the FAQ's "all"
 * flatten read, so the three cannot disagree. Resolved once, from the build constant `brand`.
 */
export const supportCategories: readonly SupportFaqCategory[] = supportCategoriesFor(
  brandIdOf(brand),
);

/** Is this the union's filter sentinel, or a category this build offers? */
export function isSupportFaqCategory(category: SupportCategory): category is SupportFaqCategory {
  return (supportCategories as readonly SupportCategory[]).includes(category);
}
