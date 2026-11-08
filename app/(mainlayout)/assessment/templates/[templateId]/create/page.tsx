/**
 * `/assessment/templates/[templateId]/create` — the create flow's stage 1, **Who** (#409, #427, #688).
 *
 * A child of the template's own address, so the template being copied is the route's own fact:
 * there is no picker. Stage 1's form posts that id back in a hidden field, and the save handler
 * (`POST /assessment/new/who`) answers with the draft cookie and a redirect to stage 2.
 *
 * The read is `readLibraryTemplate(recordId, viewerUserId)` — the same authorization the library
 * and the template detail page use: the platform's templates plus the viewer's own, and
 * `undefined` for everything else. It is asked with the **session's** id, never one from the
 * URL, and a signed-out visitor's answer is the built-ins only (`author_user_id IS NULL`
 * matches nobody).
 *
 * **No account is asked for here, and that is the point of stage 1 (#690).** Until this card a
 * signed-out visitor was shown an account gate instead of the form, because a relationship created
 * with no account is in nobody's list (#618). The endpoint never required one — `POST
 * /assessment/new` has always accepted a signed-out post and written a null initiator
 * (#146/#213) — so the screen was refusing what the server allowed, four stages before the flow
 * says the account belongs. The approved flow puts the gate *after* stage 4, in its own surface
 * (`…/create/account`), and this page now draws the form for everybody.
 *
 * **The draft is read here, so coming back to stage 1 shows what was typed (#688).** A refusal
 * from stage 1's own validation, a back-link from stage 2, or a plain reload all render this
 * page, and all three read the same cookie `POST /assessment/new/who` wrote. A first visit has
 * no cookie and renders `EMPTY_CREATE_DRAFT`.
 *
 * **A refusal is resolved here, from two codes.** `?problem=<reason>&field=<field>` is a
 * field refusal from this flow's own validation; `?problem=<FlowErrorCode>` is the store's.
 * `lib/flow/create-copy.ts` turns either into the fixture's sentence, with the field's label
 * for the first kind. Nothing anybody typed travels in the URL — the draft is the cookie.
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
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { EMPTY_CREATE_DRAFT, parseCreateDraft, type CreateDraft } from "@/lib/flow/create-draft";
import { createRefusal } from "@/lib/flow/create-copy";
import { readLibraryTemplate } from "@/lib/db/template-library";
import { TEMPLATE_LIBRARY_PATH, templateDetailPath } from "@/lib/flow/paths";
import { createDraftCookieName } from "@/lib/flow/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create a relationship",
};

type CreateParams = {
  readonly problem?: string | string[];
  readonly field?: string | string[];
};

/** The first value of a search param — Next hands a repeated param back as an array. */
function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** The draft stage 1 saved for this template, or an empty one on a first visit. */
async function savedDraft(templateRecordId: string): Promise<CreateDraft> {
  const jar = await cookies();
  return (
    parseCreateDraft(jar.get(createDraftCookieName(templateRecordId))?.value) ?? EMPTY_CREATE_DRAFT
  );
}

export default async function TemplateCreatePage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<CreateParams>;
}) {
  const { templateId } = await params;
  const query = await searchParams;
  const refusal = createRefusal(firstValue(query.problem), firstValue(query.field));
  const viewer = await currentUserIfConfigured();
  const viewerUserId = viewer?.userId ?? null;
  const detail = await readLibraryTemplate(templateId, viewerUserId);
  if (detail === undefined && refusal === null) notFound();

  const draft = await savedDraft(templateId);

  return (
    <CreateRelationship
      copy={assessmentCreatePageCopy}
      stage={1}
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
      draft={draft}
      backHref={detail === undefined ? TEMPLATE_LIBRARY_PATH : templateDetailPath(templateId)}
      problem={refusal?.sentence ?? null}
      problemLink={refusal?.link ?? null}
    />
  );
}
