/**
 * `/relationship-types/[slug]/demo` — the worked example: one Relationship Type's finished
 * report, answered by "You" and "Them", labelled `Example`, before anyone pays.
 *
 * It serves **launch criterion 5** ("the Gap report renders from both answers"): it is the only
 * place in the tree a person can read a completed report without answering one, and it is what
 * the catalogue's "worked example" link and the type's own page open. `docs/V1-RETIREMENT.md`
 * classified this surface **release** and it has moved twice since: out of the `/v1` prototype to
 * `/assessment/demo/[type]` (#478), then here, under the catalogue noun, beside the type it
 * belongs to — the address the IA decision on the demo's card chose.
 *
 * **It is in `(marketing)`, and that is a product decision, not a folder move.** The example is a
 * public surface: a stranger reads it before an account exists, so it wears the public header and
 * footer and must not render the app shell's sidebar. Nothing here calls `currentUser()`, so a
 * preview without secrets renders it instead of raising the documented auth-configuration 500,
 * and it reads no clock, no cookie and no database — the projection is a fixture.
 *
 * The page is a shell, not a second report: the projection is `lib/assessment-demo.ts` over the
 * type's sheet, and the renderer is `components/assessment/assessment-report.tsx` — the same one
 * `/assessment/[slug]` and the instance report draw. A third renderer here would be the defect
 * the release row exists to avoid, and it is why the example is a page rather than a band on
 * `…/[slug]`: a band could only be a truncated second presentation of the same report.
 *
 * The one container is `mx-auto w-full max-w-4xl`, the marketing section width
 * `components/templates/template-detail.tsx` uses, and the bands are padded `px-4 sm:px-8` so
 * they line up with the column `AssessmentReportView` draws inside itself (that component owns a
 * `StageColumn` because the two app-shell routes render it too; it is not restyled here).
 *
 * A type with no sheet, or a type that is not for sale, is a **404**: `demoAnswersFor` is what
 * both links test before they offer an example, so a URL that names no example names no page.
 */
import { AssessmentReportView } from "@/components/assessment/assessment-report";
import { formatCurrency } from "@/content/core";
import { RELATIONSHIP_PRICE_CENTS } from "@/data/relationship-types";
import { assessmentDemo } from "@/lib/assessment-demo";
import { relationshipTypePath } from "@/lib/flow/paths";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const demo = assessmentDemo(slug);
  if (demo === undefined) return { title: "Example Not Found" };
  return {
    title: `${demo.report.title} — example report`,
    description: demo.report.summary,
  };
}

export default async function RelationshipTypeDemoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const demo = assessmentDemo(slug);
  if (demo === undefined) notFound();

  return (
    <div className="bg-background" data-relationship-type-demo={demo.type.id}>
      <div className="mx-auto w-full max-w-4xl py-10">
        <div className="space-y-3 px-4 sm:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
              Example
            </span>
            <p className="text-xs text-muted-foreground">
              A finished session&apos;s report, from two sample people — you&apos;ll see your own
              answers here, under your own names.
            </p>
          </div>
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-3 text-xs">
            <Link
              href={relationshipTypePath(demo.type.id)}
              className="font-medium text-action hover:underline"
            >
              ← {demo.type.name}
            </Link>
          </nav>
        </div>

        <AssessmentReportView report={demo.report} />

        <div className="px-4 sm:px-8">
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="text-sm font-semibold text-foreground">Like what you see?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              One relationship costs {formatCurrency(RELATIONSHIP_PRICE_CENTS)}. You pay; the other
              person joins by link and pays nothing.
            </p>
            <div className="mt-3">
              <Link
                href={demo.startPath}
                className="inline-flex h-12 items-center justify-center rounded-md bg-action px-6 text-sm font-medium text-action-foreground hover:bg-action-hover"
              >
                Start this relationship
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
