import { AssessmentReportView } from "@/components/assessment/assessment-report";
import { AssessmentUnreadable } from "@/components/assessment/assessment-unreadable";
import { assessmentReport } from "@/lib/assessment-report";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { readAssessmentScreenBySlug } from "@/lib/db/assessments";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * `/assessment/[slug]` — the read of one answered assessment, from the database (#145, #204).
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
 *
 * **Three failure modes, three honest answers (#204).** The read is one statement
 * (`lib/db/assessments.ts`), and what it can say is:
 *
 *   - *no such instance*, or a template that stopped resolving → `notFound()` — a 404, unchanged;
 *   - *the database did not answer* → `AssessmentUnreadable`: a page that says so, in the
 *     database layer's own words, instead of Next's `<h1>500</h1>` and a digest nobody can act
 *     on. Nothing is rendered from a cache and no assessment is drawn from half a read;
 *   - *a row that does not parse* → still thrown. That is a code or data defect the gate exists
 *     to catch, and a 500 with a stack in the server log is the honest status for it.
 *
 * `generateMetadata` answers the middle case too, because metadata runs before the render: if it
 * threw, the browser would get the digest page even though the component below knows what to
 * say. Neither branch caches: `readAssessmentScreenBySlug` is memoised for **one** request
 * (React `cache`), so a failure is never reused and the next visit asks the database again.
 */

export const dynamic = "force-dynamic";

/** The title a screen shows when the database did not answer — never the 404's title. */
const UNREADABLE_TITLE = "This assessment could not be read";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const screen = await readAssessmentScreenBySlug(slug);
    if (screen === undefined) return { title: "Assessment Not Found" };
    return { title: screen.template.title, description: screen.template.summary };
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error(`assessment: the database did not answer for /assessment/${slug}`, error);
    return { title: UNREADABLE_TITLE, description: error.reason };
  }
}

export default async function AssessmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let screen: Awaited<ReturnType<typeof readAssessmentScreenBySlug>>;
  try {
    screen = await readAssessmentScreenBySlug(slug);
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    // The stack is here, on the server, where an operator looks; the reader gets the sentence.
    console.error(`assessment: the database did not answer for /assessment/${slug}`, error);
    return <AssessmentUnreadable slug={slug} reason={error.reason} />;
  }

  // The fixture route's semantics, unchanged: no instance for this slug, or an instance whose
  // template no longer resolves, is a 404 — never an empty report.
  if (screen === undefined) notFound();

  return <AssessmentReportView report={assessmentReport(screen.instance, screen.template)} />;
}
