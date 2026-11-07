/**
 * `/assessment/templates/[templateId]/create` — the create step (#409, wired by #427).
 *
 * A child of the template's own address, so the template being copied is the route's own fact:
 * there is no picker. The form posts that id back in a hidden field, and the endpoint reads it
 * from the post — a crafted body can name another record, which is exactly what the store's
 * `FOR SHARE OF record` checks answer.
 *
 * The read is `readLibraryTemplate(recordId, viewerUserId)` — the same authorization the library
 * and the template detail page use: the platform's templates plus the viewer's own, and
 * `undefined` for everything else. It is asked with the **session's** id, never one from the
 * URL, and a signed-out visitor's answer is the built-ins only (`author_user_id IS NULL`
 * matches nobody).
 *
 * **A signed-out visitor gets the account gate, not the form (#618).** The endpoint still accepts
 * a signed-out post and writes a null initiator (#146/#213) — that is the store's documented
 * behaviour and this card does not change it. What changed is the *screen*: it used to offer the
 * form, and a relationship created that way is in nobody's list, so its creator could not find it
 * again to invite, finish or pay for it. The gate's two links carry `next` = this template's own
 * create path (`createSignUpPath` / `createSignInPath`), which is what keeps the chosen product
 * across the auth round trip: the product is the URL, so there is nothing to lose.
 *
 * **A refusal is resolved here, from a code.** `POST /assessment/new` answers a `FlowError` with
 * a 303 to this path carrying `?problem=<code>`; this module turns the code into the fixture's
 * one sentence and hands it to the component. Nothing else is read from the query — no text
 * anybody typed travels in a URL — and an unrecognised code draws no sentence rather than an
 * invented one.
 *
 * **A template that cannot be read is a screen, not a 404, when a refusal sent us here.** The
 * codes `unknown-template`, `record-is-an-instance` and `template-not-yours` all mean the record
 * is not something this viewer may copy, so the read returns `undefined` — the same answer the
 * detail page turns into `notFound()`. Here that would swallow the refusal the post just gave, so
 * the refusal band and a way back to the library render instead. With no code in the URL the
 * answer is still `notFound()`: an address nobody posted from is not a screen.
 *
 * `force-dynamic`: this route reads a database and must not do so at build time.
 */
import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { authConfigured } from "@/lib/auth/config";
import { currentUser } from "@/lib/auth/session";
import { readLibraryTemplate } from "@/lib/db/template-library";
import {
  PRICING_PATH,
  TEMPLATE_LIBRARY_PATH,
  createSignInPath,
  createSignUpPath,
  templateDetailPath,
} from "@/lib/flow/paths";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create a relationship",
};

type ProblemParams = {
  readonly problem?: string | string[];
};

/** The first value of a search param — Next hands a repeated param back as an array. */
function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * The signed-in account id, or `null` — never a thrown error on a tree without auth env.
 *
 * The instance page resolves the viewer the same way, and for the same reason: the gate renders
 * this route with no `NEON_AUTH_*` variables at all, and a build that throws on a missing
 * session reads as a broken route rather than a signed-out one.
 */
async function viewerUserId(): Promise<string | null> {
  if (!authConfigured()) return null;
  const user = await currentUser();
  return user?.userId ?? null;
}

/**
 * The fixture's sentence for a refusal code, or `null` when there is no refusal to read.
 *
 * One branch per code rather than a computed `problem-${code}` id: E23 resolves every literal id
 * a component hands to the copy readers against the route's fixture, so a renamed item is a red
 * build. A constructed id would only resolve at runtime or throw, which is the blank band this
 * ratchet exists to prevent. The codes are the store's own `FlowErrorCode` values.
 */
function problemMessage(code: string | undefined): string | null {
  if (code === undefined) return null;
  const problems = sectionOf(assessmentCreatePageCopy, "problems");

  if (code === "invalid-input") return itemLabel(problems, "invalid-input");
  if (code === "unknown-template") return itemLabel(problems, "unknown-template");
  if (code === "template-not-published") return itemLabel(problems, "template-not-published");
  if (code === "template-has-no-aspects") return itemLabel(problems, "template-has-no-aspects");
  if (code === "record-is-an-instance") return itemLabel(problems, "record-is-an-instance");
  if (code === "template-not-yours") return itemLabel(problems, "template-not-yours");
  if (code === "instance-limit") return itemLabel(problems, "instance-limit");
  // #505 — the plan's relationship limit. Beside `instance-limit` rather than folded into it: the
  // two codes name different counts, and an operator reading `?problem=` should be able to tell
  // which gate answered.
  if (code === "relationship-limit") return itemLabel(problems, "relationship-limit");
  if (code === "mode-not-entitled") return itemLabel(problems, "mode-not-entitled");
  return null;
}

/**
 * The door a refusal's sentence points at (#618), or `null`.
 *
 * Only the two codes whose sentence names a plan get one: `relationship-limit` says "move to a paid
 * plan" and `mode-not-entitled` says "change your plan", and both used to draw nothing to click.
 * The other codes either need no action from this screen (the store refused the payload) or end at
 * the library (`unknown-template`).
 */
function problemLink(code: string | undefined): { href: string; label: string } | null {
  if (code !== "relationship-limit" && code !== "mode-not-entitled") return null;
  const problems = sectionOf(assessmentCreatePageCopy, "problems");
  return { href: PRICING_PATH, label: itemLabel(problems, "plans") };
}

export default async function TemplateCreatePage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<ProblemParams>;
}) {
  const { templateId } = await params;
  const code = firstValue((await searchParams).problem);
  const problem = problemMessage(code);
  const viewer = await viewerUserId();
  const detail = await readLibraryTemplate(templateId, viewer);
  if (detail === undefined && problem === null) notFound();

  return (
    <CreateRelationship
      copy={assessmentCreatePageCopy}
      template={
        detail === undefined
          ? null
          : {
              recordId: templateId,
              title: detail.template.title,
              summary: detail.template.summary,
              aspectCount: detail.aspects.length,
            }
      }
      backHref={detail === undefined ? TEMPLATE_LIBRARY_PATH : templateDetailPath(templateId)}
      problem={problem}
      problemLink={problemLink(code)}
      gate={
        viewer === null
          ? {
              signInHref: createSignInPath(templateId),
              signUpHref: createSignUpPath(templateId),
            }
          : null
      }
    />
  );
}
