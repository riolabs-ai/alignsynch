import { TemplateDetail } from "@/components/templates/template-detail";
import { templatesDetailPageCopy } from "@/data/pages/templates-detail";
import { templateDetail, templateSlugs } from "@/lib/template-detail";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * `/relationship-types/[slug]` — one relationship type's public page, prerendered (#794).
 *
 * Every purchasable type is a static param (`data/relationship-types.ts` through the same
 * `isPurchasable()` gate the catalogue and the shop read), so the twenty-seven pages are built
 * ahead of the request and a stranger can read a type without touching the database. A slug
 * that names no purchasable type — a typo, or one of the three dating rows the owner excluded —
 * is `notFound()`: absence is the honest answer, and it is the same 404 either way.
 *
 * The segment is the **taxonomy id**, never a record handle: a type is a row in a fixture, and
 * the templates that implement it are a different noun at `/templates/relationship/<slug>`.
 *
 * **The page's one action is the flow's stage 1, for every viewer (#1042).** "Use this template"
 * was `/register?next=…` for everybody until #979 split it by session, and #1042 closed the other
 * half: the stage renders for a signed-out visitor (#690), the account is stage 4 of that same
 * wizard, and a visitor who types Details there keeps their draft through the sign-in. So this
 * route reads no session at all — identity is not a parameter of the destination any more — and
 * every page stays prerendered, which is what lets the gate build with no auth environment.
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
