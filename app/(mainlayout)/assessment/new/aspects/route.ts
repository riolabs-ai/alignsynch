/**
 * `POST /assessment/new/aspects` — stage 3's list, saved into the draft (#689).
 *
 * One small JSON endpoint, called by the list itself on each committed gesture: an Aspect's
 * **Save**, and a drag's **drop** (the reorder is a save too — the order is part of what a party
 * answers, so it is committed like any other edit). It writes the flow's one draft cookie and
 * answers; it never creates anything, never redirects, and never renders.
 *
 * **Why JSON and not a form post.** The list is a client component and the row must collapse the
 * moment the server has the edit — a form post would take the page with it and lose which row was
 * open. The reply is `{ok: true}` or, on a refusal, `{ok: false, problem: "<field>"}`, which the
 * component turns into the fixture's own sentence with the field's label (`lib/flow/aspects.ts`
 * names the field; `data/pages/assessment-create.ts` names the words).
 *
 * **The whole list is posted, not a patch.** There is one writer of the list (this endpoint), so
 * "the list the person is looking at" is the thing to store; a patch protocol would have to
 * answer what happens when two saves race, for a cookie that holds one person's unfinished work.
 *
 * **The draft must already exist.** No cookie means no stages 1–2, and a list with no relationship
 * behind it must not create one: `409` and a code the component reports. That is also what keeps
 * this endpoint from being a way to write a draft cookie from scratch.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { aspectProblem, parseAspects } from "@/lib/flow/aspects";
import { parseCreateDraft, serializeCreateDraft } from "@/lib/flow/create-draft";
import {
  CREATE_DRAFT_COOKIE_MAX_AGE,
  createDraftCookieName,
  flowCookieOptions,
} from "@/lib/flow/session";

/** The body this endpoint accepts. Anything else is a `400`, never a coercion. */
interface AspectsBody {
  readonly templateRecordId?: unknown;
  readonly aspects?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  let body: AspectsBody;
  try {
    body = (await request.json()) as AspectsBody;
  } catch {
    return NextResponse.json({ ok: false, problem: "body" }, { status: 400 });
  }

  const templateRecordId =
    typeof body.templateRecordId === "string" ? body.templateRecordId.trim() : "";
  if (templateRecordId === "") {
    return NextResponse.json({ ok: false, problem: "template" }, { status: 400 });
  }

  const aspects = parseAspects(body.aspects);
  if (aspects === null) {
    return NextResponse.json({ ok: false, problem: "body" }, { status: 400 });
  }

  // Every row must be saveable: a list that carries an empty prompt would reach the create and be
  // refused there, a stage later, with the row the person could no longer see.
  for (const aspect of aspects) {
    const problem = aspectProblem(aspect);
    if (problem !== null) {
      return NextResponse.json({ ok: false, problem }, { status: 400 });
    }
  }

  const jar = await cookies();
  const cookieName = createDraftCookieName(templateRecordId);
  const draft = parseCreateDraft(jar.get(cookieName)?.value);
  if (draft === null) {
    return NextResponse.json({ ok: false, problem: "draft" }, { status: 409 });
  }

  jar.set(
    cookieName,
    serializeCreateDraft({ ...draft, aspects }),
    flowCookieOptions(CREATE_DRAFT_COOKIE_MAX_AGE),
  );

  return NextResponse.json({ ok: true });
}
