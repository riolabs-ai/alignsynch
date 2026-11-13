/**
 * `/templates/relationship/[slug]/create` — the create flow's stage 1, **Who** (#409, #427, #688).
 *
 * A child of the template's own address, so the template being copied is the route's own fact:
 * there is no picker. Stage 1's form posts that **record id** back in a hidden field, and the save
 * handler (`POST /assessment/new/who`) answers with the draft cookie and a redirect to stage 2.
 *
 * **The address carries the slug and the form carries the id (#794).** The segment is
 * `record.slug` — the URL's fact — while the draft cookie is keyed by `record.id` and the hidden
 * `templateRecordId` field is what the store copies from. The read below turns one into the other,
 * which is why it happens before the cookie is looked for: a page that passed the slug to
 * `createDraftCookieName()` would write a draft nobody reads.
 *
 * The read is `readLibraryTemplate(slug, viewerUserId)` — the same authorization the library
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
import { ADVANCE_CLASSES } from "@/components/assessment-flow/stage-foot";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { EMPTY_CREATE_DRAFT, parseCreateDraft, type CreateDraft } from "@/lib/flow/create-draft";
import { type CopyReadiness, stageRefusal } from "@/lib/flow/create-copy";
import { readLibraryTemplate } from "@/lib/db/template-library";
import {
  RELATIONSHIP_TEMPLATES_PATH,
  relationshipTemplatePath,
  templateStatusPath,
} from "@/lib/flow/paths";
import { itemLabel, sectionOf } from "@/lib/page-copy";
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
  if (templateRecordId === "") return EMPTY_CREATE_DRAFT;
  const jar = await cookies();
  return (
    parseCreateDraft(jar.get(createDraftCookieName(templateRecordId))?.value) ?? EMPTY_CREATE_DRAFT
  );
}

export default async function TemplateCreatePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<CreateParams>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const viewer = await currentUserIfConfigured();
  const viewerUserId = viewer?.userId ?? null;
  const detail = await readLibraryTemplate(slug, viewerUserId);

  // A refusal that sent us here and a template nobody can read are two different states: the first
  // is a screen (the band, and a way back), the second is a 404 — an address nobody posted from is
  // not a screen, and answering it with a sentence would confirm that the handle exists.
  if (detail === undefined && query.problem === undefined) notFound();

  const context = { slug, ...(detail === undefined ? {} : { recordId: detail.template.id }) };

  /**
   * **The door guard (#870).** Before this card a template that could not be copied was accepted by
   * stages 1–3 and refused by the store at the end of stage 4, after four screens of typing. The
   * question is now asked here, with the same sentences and the same order the store uses, so the
   * two ends of the flow cannot disagree about why — and `store.ts` keeps its own check as the last
   * line of defence for a crafted post.
   */
  const readiness: CopyReadiness | null =
    detail === undefined
      ? null
      : {
          status: detail.template.status,
          aspectCount: detail.aspects.length,
          authorship: detail.template.authorship,
          ...(detail.hasVersion === undefined ? {} : { hasVersion: detail.hasVersion }),
        };
  const refusal = stageRefusal(
    firstValue(query.problem),
    firstValue(query.field),
    readiness,
    context,
  );
  const blocked =
    detail !== undefined &&
    readiness !== null &&
    stageRefusal(undefined, undefined, readiness, context) !== null;

  // #794 — the storage handle for the cookie and the form field; the slug is only the address.
  const recordId = detail?.template.id ?? "";
  const draft = await savedDraft(recordId);

  /**
   * The one-click publish (#870), drawn only where it is honest: the viewer **wrote** this template
   * and it is not usable yet. It posts `status=published` to the endpoint the template page already
   * posts to and asks that endpoint to come back here (`return=create`), so publishing is the
   * existing status transition called from one more place — not a second write path, and not a
   * second set of rules.
   */
  const problems = sectionOf(assessmentCreatePageCopy, "problems");
  const publishAction =
    detail !== undefined &&
    detail.template.authorship === "mine" &&
    (detail.template.status !== "published" || detail.hasVersion === false) ? (
      <form
        action={templateStatusPath(detail.template.slug)}
        method="post"
        data-create-publish="true"
        className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
      >
        <input type="hidden" name="status" value="published" />
        {/* A validated enum, never a URL: the route rebuilds the destination itself. */}
        <input type="hidden" name="return" value="create" />
        <button type="submit" className={ADVANCE_CLASSES}>
          {itemLabel(problems, "publish-template")}
        </button>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          {itemLabel(problems, "publish-template-note")}
        </p>
      </form>
    ) : undefined;

  return (
    <CreateRelationship
      copy={assessmentCreatePageCopy}
      stage={1}
      template={
        detail === undefined
          ? null
          : {
              slug,
              recordId,
              title: detail.template.title,
              summary: detail.template.summary,
              aspectCount: detail.aspects.length,
            }
      }
      draft={draft}
      backHref={
        detail === undefined
          ? RELATIONSHIP_TEMPLATES_PATH
          : relationshipTemplatePath(detail.template.slug)
      }
      problem={refusal?.sentence ?? null}
      problemLink={refusal?.link ?? null}
      {...(publishAction === undefined ? {} : { publishAction })}
      {...(blocked ? { copyBlocked: true } : {})}
    />
  );
}
