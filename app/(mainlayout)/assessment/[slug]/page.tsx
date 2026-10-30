import { AssessmentReportView } from "@/components/assessment/assessment-report";
import { assessmentReport } from "@/lib/assessment-report";
import { readAssessmentScreenBySlug } from "@/lib/db/assessments";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * `/assessment/[slug]` — the read of one answered assessment, from the database (#145).
 *
 * The slug names an **instance** (an `assessment_instance` row and its `record`), not the
 * template: the template has no parties, so it has no answers to draw. The title and summary
 * above the rows are read off the template the instance names, which is why a copy whose
 * `templateId` stopped resolving is a 404 here as well as a `db:verify` failure — there is no
 * second source for the words.
 *
 * **Request-time, not build-time.** `generateStaticParams()` is gone on purpose: it would be a
 * database read at build, and `pnpm build` must pass with `DATABASE_URL` unset. So this route
 * is `force-dynamic` and every render asks the database.
 *
 * Nothing on this route writes: no form, no action, no `"use client"` beneath it. It is a
 * function of two records and `gapOf()`, so the answer to "how big is the gap" is the same on
 * every render and there is no stored copy to drift.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const screen = await readAssessmentScreenBySlug(slug);
  if (screen === undefined) return { title: "Assessment Not Found" };
  return { title: screen.template.title, description: screen.template.summary };
}

export default async function AssessmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const screen = await readAssessmentScreenBySlug(slug);
  // The fixture route's semantics, unchanged: no instance for this slug, or an instance whose
  // template no longer resolves, is a 404 — never an empty report.
  if (screen === undefined) notFound();

  return <AssessmentReportView report={assessmentReport(screen.instance, screen.template)} />;
}
