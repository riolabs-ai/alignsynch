/**
 * `/templates/relationship/[slug]/create/mode` — the create flow's stage 2, **Mode** (#688, #794).
 *
 * The second step reads the draft stage 1 wrote and asks the last two questions before anything
 * is created: which Mode both parties answer, and which Setting the report is judged against.
 * It is a page rather than a panel on stage 1 so that it can be reloaded, linked and cached by
 * its own address — and because stage 3 (`…/create/aspects`) and slice 4's create are siblings,
 * which is the shape the approved flow describes.
 *
 * **The draft is keyed by the record id, not by the slug in the address.** The template read
 * happens first for exactly that reason: it is what turns `[slug]` into `record.id`, and a page
 * that keyed the cookie on the slug would look for a draft nobody wrote (§#794, trap 1).
 *
 * **It saves; it does not create (#689).** Until stage 3 existed, this screen's form posted to
 * `POST /assessment/new` and the second of six stages created the relationship. The approved flow
 * puts the Aspects between Mode and the invite, so the form posts to `POST /assessment/new/mode`,
 * which merges the two choices into the same draft and answers a 303 to stage 3. The create is
 * behind stage 3's own control.
 *
 * **No draft, no stage 2.** A person who deep-links this address without passing through stage 1
 * has nothing to commit, so the page sends them back to Who. Since #690 that redirect is the
 * *only* gate here: a signed-out visitor goes straight through, because the account is asked for
 * after stage 4 (`…/create/account`) and never in front of a form the endpoint accepts from
 * anybody.
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
import { createRelationshipPath } from "@/lib/flow/paths";
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
  params: Promise<{ slug: string }>;
  searchParams: Promise<ModeParams>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const whoPath = createRelationshipPath(slug);

  const viewer = await currentUserIfConfigured();
  const viewerUserId = viewer?.userId ?? null;

  // #870 — the read comes first so the refusal can name its door: the template's page is addressed
  // by slug, its editor by `record.id`, and a band without either is the wall this card removes.
  const detail = await readLibraryTemplate(slug, viewerUserId);
  const refusal = createRefusal(firstValue(query.problem), firstValue(query.field), {
    slug,
    ...(detail === undefined ? {} : { recordId: detail.template.id }),
  });
  if (detail === undefined && refusal === null) notFound();

  // #794 — the cookie is the record's, the address is the row's slug. No readable template means
  // no id to look up, so the screen sends the person to the stage that starts the flow.
  const jar = await cookies();
  const draft =
    detail === undefined
      ? null
      : parseCreateDraft(jar.get(createDraftCookieName(detail.template.id))?.value);
  if (draft === null) redirect(whoPath);

  return (
    <CreateRelationship
      copy={assessmentCreatePageCopy}
      stage={2}
      template={
        detail === undefined
          ? null
          : {
              slug: detail.template.slug,
              recordId: detail.template.id,
              title: detail.template.title,
              summary: detail.template.summary,
              aspectCount: detail.aspects.length,
            }
      }
      draft={draft}
      backHref={whoPath}
      problem={refusal?.sentence ?? null}
      problemLink={refusal?.link ?? null}
    />
  );
}
