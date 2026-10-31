import type { Metadata } from "next";
import { Footer } from "@/components/layout/footer";
import CreatorTipsPage from "@/components/creator-tips/creator-tips-page";
import { creatorTipsPageCopy } from "@/data/pages/creator-tips";
import { shellPageCopy } from "@/data/pages/shell";
import { requireQuizProduct } from "@/lib/brand-boundary";
import { hiddenNavHrefs } from "@/lib/flags";
import { sectionOf } from "@/lib/page-copy";

export const metadata: Metadata = {
  title: "Quiz Creator Tips",
  description:
    "Discover tips, strategies, and best practices for creating engaging and effective quizzes.",
};

/**
 * The creator-tips index. `CreatorTipsPage` composes five bands, so each one's
 * words are resolved here from `data/pages/creator-tips.ts` and handed down — the
 * component forwards sections, it never picks a fixture (E23).
 *
 * Quiz-only (#300): advice for quiz authors, so the alignment build answers 404 before the
 * five bands are resolved.
 */
export default function CreatorTips() {
  requireQuizProduct();
  return (
    <>
      <CreatorTipsPage
        hero={sectionOf(creatorTipsPageCopy, "hero")}
        categories={sectionOf(creatorTipsPageCopy, "categories")}
        featured={sectionOf(creatorTipsPageCopy, "featured")}
        grid={sectionOf(creatorTipsPageCopy, "tips-grid")}
        cta={sectionOf(creatorTipsPageCopy, "cta")}
      />
      <Footer copy={shellPageCopy} hiddenNav={hiddenNavHrefs()} />
    </>
  );
}
