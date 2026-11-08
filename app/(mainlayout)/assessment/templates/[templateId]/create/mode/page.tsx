/**
 * `/assessment/templates/[templateId]/create/mode` — the create flow's stage 2, **Mode** (#688).
 *
 * The second step reads the draft stage 1 wrote and asks the last two questions before anything
 * is created: which Mode both parties answer, and which Setting the report is judged against.
 * It is a page rather than a panel on stage 1 so that it can be reloaded, linked and cached by
 * its own address — and because stage 3 (`…/create/aspects`) and slice 4's create are siblings,
 * which is the shape the approved flow describes.
 *
 * **It saves; it does not create (#689).** Until stage 3 existed, this screen's form posted to
 * `POST /assessment/new` and the second of six stages created the relationship. The approved flow
 * puts the Aspects between Mode and the invite, so the form posts to `POST /assessment/new/mode`,
 * which merges the two choices into the same draft and answers a 303 to stage 3. The create is
 * behind stage 3's own control.
 *
 * **No draft, no stage 2.** A person who deep-links this address without passing through stage 1
 * has nothing to commit, so the page sends them back to Who — where the account gate lives too.
 * The same redirect covers a session that ended between the steps: a relationship created with
 * no account is in nobody's list, and the gate is the screen that says so.
 *
 * **A refusal lands here when the Mode or the Setting was refused** — `?problem=<reason>&field=`
 * — and on stage 1 when the store refused the template itself. `lib/flow/create-copy.ts`
 * composes the sentence in both cases; the field is named by its own label, never by a column.
 *
 * `force-dynamic`: the template read is a database read, and the draft is a request cookie.
 */
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { createRefusal } from "@/lib/flow/create-copy";
import { parseCreateDraft } from "@/lib/flow/create-draft";
import { readLibraryTemplate } from "@/lib/db/template-library";
import {
  TEMPLATE_LIBRARY_PATH,
  createRelationshipPath,
  templateDetailPath,
} from "@/lib/flow/paths";
import { createDraftCookieName } from "@/lib/flow/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mode and setting",
};

type ModeParams = {
  readonly problem?: string | string[];
  readonly field?: string | string[];
};

/** The first value of a search param — Next hands a repeated param back as an array. */
function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function TemplateCreateModePage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<ModeParams>;
}) {
  const { templateId } = await params;
  const query = await searchParams;
  const whoPath = createRelationshipPath(templateId);

  const jar = await cookies();
  const draft = parseCreateDraft(jar.get(createDraftCookieName(templateId))?.value);
  if (draft === null) redirect(whoPath);

  const viewer = await currentUserIfConfigured();
  const viewerUserId = viewer?.userId ?? null;
  if (viewerUserId === null) redirect(whoPath);

  const refusal = createRefusal(firstValue(query.problem), firstValue(query.field));
  const detail = await readLibraryTemplate(templateId, viewerUserId);
  if (detail === undefined && refusal === null) notFound();

  return (
    <CreateRelationship
      copy={assessmentCreatePageCopy}
      stage={2}
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
      backHref={whoPath}
      problem={refusal?.sentence ?? null}
      problemLink={refusal?.link ?? null}
      gate={null}
    />
  );
}
