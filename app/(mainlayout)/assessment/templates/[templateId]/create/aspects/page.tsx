/**
 * `/assessment/templates/[templateId]/create/aspects` — the create flow's stage 3, **Aspects**
 * (#689).
 *
 * The stage reads the draft stages 1 and 2 wrote and the template the draft names, then hands
 * both to `CreateRelationship` as `stage={3}`. It owns three facts the component does not:
 *
 *   - **the draft**, or a redirect back to Who. A person who deep-links this address without
 *     passing through the two earlier stages has nothing to copy and no relationship to name, so
 *     the screen sends them to the stage that starts it. Since #690 that is the only gate: a
 *     signed-out visitor goes straight through, because the account is asked for after the create
 *     (`…/create/account`), never in front of a form — a relationship with no account is created
 *     and invited exactly like any other;
 *   - **the template's own list**, read through `readLibraryTemplate()` with the *session's* id —
 *     the same authorization the library, the detail page and the two earlier stages use. It is
 *     what a first visit seeds the working list from;
 *   - **the working list**, which is the draft's when stage 3 has already saved (`aspects` is
 *     present) and the template's when it has not (`lib/flow/aspects.ts::workingAspects`). The
 *     distinction is deliberate: absent means "untouched, seed it", and an empty array means "a
 *     list the person emptied" — collapsing the two would restore the template under somebody who
 *     had just deleted from it.
 *
 * **A refusal lands here when the create refused.** `POST /assessment/new` answers a store code
 * with `?problem=<code>` and this page composes the sentence from the fixture
 * (`lib/flow/create-copy.ts`), the same band stages 1 and 2 draw — a create that was refused must
 * not lose the list the person had just spent a stage arranging. A Mode or Setting refusal goes
 * back to the Mode screen instead, because that is the field it names.
 *
 * `force-dynamic`: the template read is a database read and the draft is a request cookie.
 */
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { aspectsFromTemplate, workingAspects } from "@/lib/flow/aspects";
import { createRefusal } from "@/lib/flow/create-copy";
import { parseCreateDraft } from "@/lib/flow/create-draft";
import { readLibraryTemplate } from "@/lib/db/template-library";
import { createModePath, createRelationshipPath } from "@/lib/flow/paths";
import { createDraftCookieName } from "@/lib/flow/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aspects",
};

type AspectsParams = {
  readonly problem?: string | string[];
  readonly field?: string | string[];
};

/** The first value of a search param — Next hands a repeated param back as an array. */
function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function TemplateCreateAspectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<AspectsParams>;
}) {
  const { templateId } = await params;
  const query = await searchParams;
  const whoPath = createRelationshipPath(templateId);
  const modePath = createModePath(templateId);

  const jar = await cookies();
  const draft = parseCreateDraft(jar.get(createDraftCookieName(templateId))?.value);
  if (draft === null) redirect(whoPath);

  const viewer = await currentUserIfConfigured();
  const viewerUserId = viewer?.userId ?? null;

  const refusal = createRefusal(firstValue(query.problem), firstValue(query.field));
  const detail = await readLibraryTemplate(templateId, viewerUserId);
  if (detail === undefined && refusal === null) notFound();

  const templateAspects = detail === undefined ? [] : aspectsFromTemplate(detail.aspects);

  return (
    <CreateRelationship
      copy={assessmentCreatePageCopy}
      stage={3}
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
      aspects={workingAspects(draft.aspects, templateAspects)}
      backHref={modePath}
      problem={refusal?.sentence ?? null}
      problemLink={refusal?.link ?? null}
    />
  );
}
