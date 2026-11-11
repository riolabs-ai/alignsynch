import { TemplateDetail } from "@/components/templates/template-detail";
import { templatesDetailPageCopy } from "@/data/pages/templates-detail";
import { templateDetail, templateSlugs } from "@/lib/template-detail";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * `/templates/[slug]` — one relationship template's public page, prerendered.
 *
 * Every purchasable type is a static param (`data/relationship-types.ts` through the same
 * `isPurchasable()` gate the catalogue and the shop read), so the twenty-seven pages are built
 * ahead of the request and a stranger can read a template without touching the database. A slug
 * that names no purchasable type — a typo, or one of the three dating rows the owner excluded —
 * is `notFound()`: absence is the honest answer, and it is the same 404 either way.
 *
 * **Nothing here is dynamic.** No clock, no cookie, no session, no store read: the page is a
 * projection of `data/relationship-types.ts` through `data/pages/templates-detail.ts`, which is
 * what lets `next build` list it with a prerender marker rather than `ƒ`.
 *
 * The title is relative: the root layout's template composes `<name> · <brand>`, so the brand is
 * named once, by the layout.
 */
export async function generateStaticParams() {
  return templateSlugs().map((slug) => ({ slug }));
}

/**
 * The template's own name, from the record the slug resolves to. A slug that resolves to nothing
 * has no name to show, and the page below answers 404 rather than inventing one.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const model = templateDetail(templatesDetailPageCopy, slug);
  return model === undefined ? {} : { title: model.name };
}

/** One template, resolved before the view mounts — `params` is a Promise in Next 16. */
export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const model = templateDetail(templatesDetailPageCopy, slug);

  if (model === undefined) notFound();

  return <TemplateDetail model={model} />;
}
