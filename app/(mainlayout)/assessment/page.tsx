import { TemplateList } from "@/components/assessment-flow/template-list";
import { assessmentPageCopy } from "@/data/pages/assessment";
import { currentUserIfConfigured } from "@/lib/auth/session";
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

export default async function AssessmentIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string | string[] }>;
}) {
  // The catalogue is narrowed to what this account may copy: the platform's templates plus its
  // own (#console 5/5). `currentUserIfConfigured()` and not `currentUser()` because this page has
  // never required a session — a deployment with no auth configured still renders the built-ins,
  // and a signed-out visitor gets them too (`author_user_id = NULL` matches nobody's id).
  const user = await currentUserIfConfigured();
  const templates = await listPublishedTemplates(user?.userId ?? null);
  const { created } = await searchParams;
  // `?created=` is the id the save redirected with (#255). Resolved against the list just read, so
  // a stale or crafted id draws nothing: the notice never renders a string that is not a template
  // this page is already showing.
  const createdId = typeof created === "string" ? created : undefined;
  const createdTitle = templates.find((template) => template.id === createdId)?.title ?? null;
  return (
    <TemplateList copy={assessmentPageCopy} templates={templates} createdTitle={createdTitle} />
  );
}
