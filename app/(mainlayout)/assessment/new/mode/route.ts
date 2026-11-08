/**
 * `POST /assessment/new/mode` — stage 2 saves its two choices and hands over to stage 3 (#689).
 *
 * Before this endpoint existed the Mode form posted straight to `CREATE_INSTANCE_PATH`, and the
 * relationship was created by the *second* of the six stages. The approved flow
 * (`docs/review/artifacts/prototype-relationship-lifecycle-v5.html`, #659) puts **Aspects**
 * between Mode and the create, and the create itself behind the last stage's own control — so
 * this handler does what stage 1's does one step earlier: validate, merge into the one draft
 * cookie, and redirect. Nothing is created here either.
 *
 * **The previous draft is the merge's base.** `modeDraft` spreads what it was given, so Stage 1's
 * names, address, title and description survive — and so does stage 3's list, if the person came
 * *back* here from it.
 *
 * **A refusal is a redirect that names the field**, exactly as `POST /assessment/new/who`: the
 * query carries `?problem=<reason>&field=<field>` and the Mode page composes the sentence from
 * the fixture with that field's own label. Nothing anybody typed travels in the URL.
 *
 * **303, not 307.** Both outcomes are followed by a GET, so a reload of stage 3 cannot re-post
 * stage 2.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { modeDraft, parseCreateDraft, serializeCreateDraft } from "@/lib/flow/create-draft";
import {
  CREATE_DRAFT_COOKIE_MAX_AGE,
  createDraftCookieName,
  flowCookieOptions,
} from "@/lib/flow/session";
import {
  TEMPLATE_LIBRARY_PATH,
  createAspectsPath,
  createModePath,
  createRelationshipPath,
} from "@/lib/flow/paths";

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData();
  const value = (name: string) => String(form.get(name) ?? "");
  const templateRecordId = value("templateRecordId").trim();

  // A post that names no template has no stage to return to; the library lists what can be copied.
  if (templateRecordId === "") {
    return NextResponse.redirect(new URL(TEMPLATE_LIBRARY_PATH, request.url), 303);
  }

  const jar = await cookies();
  const previous = parseCreateDraft(jar.get(createDraftCookieName(templateRecordId))?.value);

  // No draft means the person never passed through stage 1 — there is nothing to merge into and
  // no relationship to name. The Who screen is where the flow starts, so that is where a lone
  // Mode post is sent.
  if (previous === null) {
    return NextResponse.redirect(
      new URL(createRelationshipPath(templateRecordId), request.url),
      303,
    );
  }

  const step = modeDraft(value, previous);
  if (!step.ok) {
    const target = new URL(createModePath(templateRecordId), request.url);
    target.searchParams.set("problem", step.problem.reason);
    target.searchParams.set("field", step.problem.field);
    return NextResponse.redirect(target, 303);
  }

  jar.set(
    createDraftCookieName(templateRecordId),
    serializeCreateDraft(step.draft),
    flowCookieOptions(CREATE_DRAFT_COOKIE_MAX_AGE),
  );

  return NextResponse.redirect(new URL(createAspectsPath(templateRecordId), request.url), 303);
}
