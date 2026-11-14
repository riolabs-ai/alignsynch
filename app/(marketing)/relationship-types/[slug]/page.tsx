import { TemplateDetail } from "@/components/templates/template-detail";
import { brand, brandIdOf } from "@/data/brand";
import { templatesDetailPageCopy } from "@/data/pages/templates-detail";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { startViewer, visitorOf } from "@/lib/start-path";
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
 * **The page's one action is the viewer's (#979).** "Use this template" was `/register?next=…`
 * for everybody, so a member with a live session — the person who already bought into the product
 * — was sent to the sign-up page from the type they had just chosen. `currentUserIfConfigured()`
 * answers the request's session, `startViewer()` turns it into the one fact the model needs, and
 * `lib/start-path.ts` decides the destination: the create flow's stage 1 for a member,
 * `/register?next=<that stage>` for a visitor. This route is already request-time in a deployment
 * (the group's layout reads the same session for the account slot, #317), so the render mode does
 * not change; the gate and CI carry no auth environment, the answer is `null` there, and every
 * page still prerenders.
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
 *
 * The viewer is the **visitor**: metadata prints a title, and no title is a destination. Passing
 * one anyway keeps `templateDetail()` a single function of one shape rather than a second model
 * builder for the head.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const model = templateDetail(templatesDetailPageCopy, slug, visitorOf(brandIdOf(brand)));
  return model === undefined ? {} : { title: model.name };
}

/** One template, resolved before the view mounts — `params` is a Promise in Next 16. */
export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const signedIn = (await currentUserIfConfigured()) !== null;
  const model = templateDetail(
    templatesDetailPageCopy,
    slug,
    startViewer(brandIdOf(brand), signedIn),
  );

  if (model === undefined) notFound();

  return <TemplateDetail model={model} />;
}
