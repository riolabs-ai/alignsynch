import { TemplateList } from "@/components/assessment-flow/template-list";
import { assessmentPageCopy } from "@/data/pages/assessment";
import { listPublishedTemplates } from "@/lib/flow/store";
import type { Metadata } from "next";

/**
 * `/assessment` — the published templates, each with its create form (#146).
 *
 * `force-dynamic` for the reason `/assessment/[slug]` carries it: the list is a database
 * read, and `pnpm build` must pass with `DATABASE_URL` unset. Nothing here is prerendered.
 *
 * The page is the surface E23 attributes (`data/pages/budget.ts`); the components it mounts
 * live in `components/assessment-flow/`, and every word they render is in the fixture.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Assessments",
};

export default async function AssessmentIndexPage() {
  const templates = await listPublishedTemplates();
  return <TemplateList copy={assessmentPageCopy} templates={templates} />;
}
