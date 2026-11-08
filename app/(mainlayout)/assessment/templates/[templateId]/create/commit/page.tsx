/**
 * `/assessment/templates/[templateId]/create/commit` — the create flow's stage 4, **Create**
 * (#690).
 *
 * The stage that reviews the six facts, offers the two plans and holds the conversion: the one
 * control in the flow that writes. It reads the same draft stages 1–3 wrote — who, the address,
 * the title, the Mode, the Setting and the list — and hands it to `CreateRelationship` as
 * `stage={4}`; the form posts `templateRecordId` and nothing else, because everything else the
 * endpoint needs is already in the cookie.
 *
 * **No account is asked for here** (#690). The stage-1 gate that used to stand in front of the
 * form is gone: the endpoint has always accepted a signed-out post and written a null initiator
 * (#146/#213), and the approved flow puts the account *behind* this stage, in its own surface
 * (`…/create/account`). A signed-out visitor therefore fills in all four stages and creates the
 * relationship exactly as a signed-in one does; the read below is asked with the session's id when
 * there is one, and with `null` when there is not — which is the built-ins only, the same answer
 * the library gives a stranger.
 *
 * **No draft, no stage 4.** A person who deep-links this address without passing through the three
 * stages before it has nothing to review and nothing to commit, so the page sends them back to Who
 * — the same redirect stages 2 and 3 make, and the reason the gate after this one can prove it was
 * reached through the flow.
 *
 * `force-dynamic`: the template read is a database read and the draft is a request cookie.
 */
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { readLibraryTemplate } from "@/lib/db/template-library";
import { createRefusal } from "@/lib/flow/create-copy";
import { parseCreateDraft } from "@/lib/flow/create-draft";
import { createAspectsPath, createRelationshipPath } from "@/lib/flow/paths";
import { createDraftCookieName } from "@/lib/flow/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create the relationship",
};

type CommitParams = {
  readonly problem?: string | string[];
  readonly field?: string | string[];
};

/** The first value of a search param — Next hands a repeated param back as an array. */
function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function TemplateCreateCommitPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<CommitParams>;
}) {
  const { templateId } = await params;
  const query = await searchParams;
  const whoPath = createRelationshipPath(templateId);
  const aspectsPath = createAspectsPath(templateId);

  const jar = await cookies();
  const draft = parseCreateDraft(jar.get(createDraftCookieName(templateId))?.value);
  if (draft === null) redirect(whoPath);

  const viewer = await currentUserIfConfigured();
  const refusal = createRefusal(firstValue(query.problem), firstValue(query.field));
  const detail = await readLibraryTemplate(templateId, viewer?.userId ?? null);
  if (detail === undefined && refusal === null) notFound();

  return (
    <CreateRelationship
      copy={assessmentCreatePageCopy}
      stage={4}
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
      backHref={aspectsPath}
      problem={refusal?.sentence ?? null}
      problemLink={refusal?.link ?? null}
    />
  );
}
