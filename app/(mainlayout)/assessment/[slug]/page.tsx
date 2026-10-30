import { AssessmentReportView } from "@/components/assessment/assessment-report";
import { assessmentInstances, assessments } from "@/data/assessments";
import { assessmentReport, instanceBySlug } from "@/lib/assessment-report";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * `/assessment/[slug]` — the read of one answered assessment.
 *
 * The slug names an **instance** (`data/assessments.ts::assessmentInstances`), not the
 * template: the template has no parties, so it has no answers to draw. The title and
 * summary above the rows are read off the template the instance names, which is why a
 * copy whose `templateId` stopped resolving is a 404 here as well as an E31 failure in
 * `data:check` — there is no second source for the words.
 *
 * Nothing on this route writes: no form, no action, no `"use client"` beneath it. It is a
 * function of two fixtures and `gapOf()`, so the answer to "how big is the gap" is the
 * same on every render and there is no stored copy to drift.
 */

/** Every instance a slug exists for — the route prerenders one page per record at build. */
export async function generateStaticParams() {
  return assessmentInstances.map((instance) => ({ slug: instance.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const instance = instanceBySlug(slug, assessmentInstances);
  if (instance === undefined) return { title: "Assessment Not Found" };

  const template = assessments.find((entry) => entry.id === instance.templateId);
  return template === undefined
    ? { title: instance.title, description: instance.summary }
    : { title: template.title, description: template.summary };
}

export default async function AssessmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const instance = instanceBySlug(slug, assessmentInstances);
  if (instance === undefined) notFound();

  const template = assessments.find((entry) => entry.id === instance.templateId);
  if (template === undefined) notFound();

  return <AssessmentReportView report={assessmentReport(instance, template)} />;
}
