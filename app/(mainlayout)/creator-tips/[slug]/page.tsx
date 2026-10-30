import TipDetail from "@/components/creator-tips/tip-detail";
import { Footer } from "@/components/layout/footer";
import { getTipBySlug, tips } from "@/data/creator-tips-data";
import { creatorTipsDetailPageCopy } from "@/data/pages/creator-tips-detail";
import { shellPageCopy } from "@/data/pages/shell";
import { sectionOf } from "@/lib/page-copy";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { use } from "react";

export async function generateStaticParams() {
  return tips.map((tip) => ({
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
  const tip = getTipBySlug(slug);

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

export default function TipPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const tip = getTipBySlug(slug);

  if (!tip) {
    notFound();
  }

  return (
    <>
      <TipDetail
        tip={tip}
        copy={sectionOf(creatorTipsDetailPageCopy, "article")}
        related={sectionOf(creatorTipsDetailPageCopy, "related")}
      />
      <Footer copy={shellPageCopy} />
    </>
  );
}
