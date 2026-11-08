/**
 * `/assessment/demo/[type]` — the worked example: one Relationship Type's finished report,
 * answered by "You" and "Them", labelled `Example`, before anyone pays.
 *
 * It serves **launch criterion 5** ("the Gap report renders from both answers"): it is the only
 * place in the tree a person can read a completed report without answering one, and it is what
 * the template catalogue's "See an example" and the front page's example link open. Both live
 * modules used to link into the `/v1` prototype; `docs/V1-RETIREMENT.md` classified this surface
 * **release** and named its destination as this route — a segment of its own, because
 * `[templateId]` already owns `/assessment/templates/<id>` and Next refuses two dynamic names at
 * one level.
 *
 * The page is a shell, not a second report: the projection is `lib/assessment-demo.ts` over the
 * type's sheet, and the renderer is `components/assessment/assessment-report.tsx` — the same one
 * `/assessment/[slug]` and the instance report draw. A third renderer here would be the defect
 * the release row exists to avoid.
 *
 * A type with no sheet, or a type that is not for sale, is a **404**: `demoAnswersFor` is what
 * both links test before they offer an example, so a URL that names no example names no page.
 * Nothing on this route reads a clock or a database, so it is safe to prerender — and it must be,
 * because the catalogue that links it is a fixture page.
 */
import { StageColumn } from "@/components/assessment-flow/stage-column";
import { AssessmentReportView } from "@/components/assessment/assessment-report";
import { formatCurrency } from "@/content/core";
import { RELATIONSHIP_PRICE_CENTS } from "@/data/relationship-types";
import { assessmentDemo } from "@/lib/assessment-demo";
import { TEMPLATE_LIBRARY_PATH } from "@/lib/flow/paths";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>;
}): Promise<Metadata> {
  const { type } = await params;
  const demo = assessmentDemo(type);
  if (demo === undefined) return { title: "Example Not Found" };
  return {
    title: `${demo.report.title} — example report`,
    description: demo.report.summary,
  };
}

export default async function AssessmentDemoPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const demo = assessmentDemo(type);
  if (demo === undefined) notFound();

  return (
    <div className="space-y-6">
      <StageColumn>
        <div className="space-y-3">
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
            <Link href={TEMPLATE_LIBRARY_PATH} className="font-medium text-action hover:underline">
              ← {demo.type.name} in the template library
            </Link>
          </nav>
        </div>
      </StageColumn>

      <AssessmentReportView report={demo.report} />

      <StageColumn>
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
      </StageColumn>
    </div>
  );
}
