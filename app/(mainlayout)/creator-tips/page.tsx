import type { Metadata } from "next";
import { Footer } from "@/components/layout/footer";
import CreatorTipsPage from "@/components/creator-tips/creator-tips-page";
import { creatorTipsPageCopy } from "@/data/pages/creator-tips";
import { shellPageCopy } from "@/data/pages/shell";
import { sectionOf } from "@/lib/page-copy";

export const metadata: Metadata = {
  title: "Quiz Creator Tips - Learn How to Create Better Quizzes",
  description:
    "Discover tips, strategies, and best practices for creating engaging and effective quizzes.",
};

/**
 * The creator-tips index. `CreatorTipsPage` composes five bands, so each one's
 * words are resolved here from `data/pages/creator-tips.ts` and handed down — the
 * component forwards sections, it never picks a fixture (E23).
 */
export default function CreatorTips() {
  return (
    <>
      <CreatorTipsPage
        hero={sectionOf(creatorTipsPageCopy, "hero")}
        categories={sectionOf(creatorTipsPageCopy, "categories")}
        featured={sectionOf(creatorTipsPageCopy, "featured")}
        grid={sectionOf(creatorTipsPageCopy, "tips-grid")}
        cta={sectionOf(creatorTipsPageCopy, "cta")}
      />
      <Footer copy={shellPageCopy} />
    </>
  );
}
