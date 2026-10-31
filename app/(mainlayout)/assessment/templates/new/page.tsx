/**
 * `/assessment/templates/new` — author a template (#255).
 *
 * Until this route existed a person could create an instance from the four seeded templates and
 * nothing else; the model already held what a template is (a record with items and no party rows),
 * and only the surface was missing.
 *
 * **Signed in only, decided on the server.** `currentUser()` resolves the account from the
 * request's own cookies before anything is read, and a request with no session is answered with
 * `redirect(/login?next=…)` — the same answer `/assessment/instances` gives — so the sign-in round
 * trip returns to this form. The POST endpoint asks the same question again
 * (`app/(mainlayout)/assessment/templates/route.ts`); hiding the form is not enforcement.
 *
 * **The refusal is read off the URL and resolved here, not by the component.** `?problem=` carries
 * one of `lib/flow/template-draft.ts`'s codes and `?aspect=` a number, and this module turns them
 * into the fixture's sentence. Nothing else is read from the query — the text a person typed never
 * travels in a URL — and an unrecognised code draws no sentence at all rather than an invented one.
 *
 * `force-dynamic` for the reason every other gated route carries it: the session is per-request, and
 * `pnpm build` must pass with no `DATABASE_URL` and no `NEON_AUTH_*` set, so nothing here is
 * prerendered.
 */
import { TemplateForm } from "@/components/assessment-flow/template-form";
import { assessmentTemplatePageCopy } from "@/data/pages/assessment-template-new";
import { loginPathFor } from "@/lib/auth/paths";
import { currentUser } from "@/lib/auth/session";
import { NEW_TEMPLATE_PATH } from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Write a template",
};

type ProblemParams = {
  readonly problem?: string | string[];
  readonly aspect?: string | string[];
};

/** The first value of a search param — Next hands a repeated param back as an array. */
function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * The fixture's sentence for a refusal code, or `null` when there is no refusal to read.
 *
 * Written as one branch per code rather than a computed `problem-${code}` id on purpose: E23
 * resolves every literal id a component hands to the copy readers against the route's fixture, so a
 * renamed item is a red build. A constructed id would only resolve at runtime or throw, which is the
 * blank band this ratchet exists to prevent.
 */
function problemMessage(code: string | undefined, aspect: string | undefined): string | null {
  if (code === undefined) return null;
  const problems = sectionOf(assessmentTemplatePageCopy, "problems");
  const parsed = aspect === undefined ? Number.NaN : Number(aspect);
  const aspectNumber = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;

  if (code === "no-title") return itemLabel(problems, "no-title");
  if (code === "no-aspects") return itemLabel(problems, "no-aspects");
  if (code === "too-many-aspects") return itemLabel(problems, "too-many-aspects");
  if (code === "duplicate-prompt") return itemLabel(problems, "duplicate-prompt");
  if (code === "missing-question") {
    return fillLabel(itemLabel(problems, "missing-question"), { aspect: aspectNumber });
  }
  if (code === "missing-value") {
    return fillLabel(itemLabel(problems, "missing-value"), { aspect: aspectNumber });
  }
  return null;
}

export default async function NewTemplatePage({
  searchParams,
}: {
  searchParams: Promise<ProblemParams>;
}) {
  const user = await currentUser();
  if (user === null) redirect(loginPathFor(NEW_TEMPLATE_PATH));

  const params = await searchParams;
  const problem = problemMessage(firstValue(params.problem), firstValue(params.aspect));

  return <TemplateForm copy={assessmentTemplatePageCopy} problem={problem} />;
}
