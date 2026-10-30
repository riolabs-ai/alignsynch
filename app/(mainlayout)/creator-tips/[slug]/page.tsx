import TipDetail from "@/components/creator-tips/tip-detail";
import { Footer } from "@/components/layout/footer";
import { creatorTipsDetailPageCopy } from "@/data/pages/creator-tips-detail";
import { shellPageCopy } from "@/data/pages/shell";
import { publishedArticle, publishedArticles, relatedArticles } from "@/lib/article-records";
import { sectionOf } from "@/lib/page-copy";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { use } from "react";

/**
 * The tips a build prerenders. Published only: an unpublished tip has no URL, so it has
 * no static param either (issue #165).
 */
export async function generateStaticParams() {
  return publishedArticles("tip").map((tip) => ({
    slug: tip.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  // Was `GenerateMetadata` (capital G), which Next never reads — the same dead
  // export as D14 on the category route. The `use()` call is gone with it:
  // `use` is a hook and cannot run in a plain async function.
  const { slug } = await params;
  const tip = publishedArticle("tip", slug);

  if (!tip) {
    return {
      title: "Tip Not Found",
      description: "The requested tip could not be found.",
    };
  }

  return {
    title: tip.title,
    description: tip.summary,
  };
}

/**
 * `/creator-tips/[slug]` — the slug resolves to an article record before anything
 * renders. A tip that is not published and a slug that is not a record are the same
 * 404 here, which is what keeps a draft out of the reader's way.
 */
export default function TipPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const tip = publishedArticle("tip", slug);

  if (!tip) {
    notFound();
  }

  return (
    <>
      <TipDetail
        tip={tip}
        relatedTips={relatedArticles(tip)}
        copy={sectionOf(creatorTipsDetailPageCopy, "article")}
        related={sectionOf(creatorTipsDetailPageCopy, "related")}
      />
      <Footer copy={shellPageCopy} />
    </>
  );
}
