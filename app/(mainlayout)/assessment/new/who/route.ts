/**
 * `POST /assessment/new/who` — stage 1 saves the draft and hands over to stage 2 (#688).
 *
 * The first step of the create flow never writes a relationship: it validates **Who** and puts
 * the answers in one cookie (`lib/flow/create-draft.ts`) before redirecting to the Mode stage.
 * That separation is the point of the slice — "Continue" cannot half-create something, and a
 * reload of stage 2 reads the same object stage 1 wrote.
 *
 * **A refusal is a redirect that names the field.** `?problem=<reason>&field=<field>` goes back
 * to the Who screen, which composes the sentence from the fixture with that field's own label
 * (`lib/flow/create-copy.ts`). Nothing anybody typed travels in the URL: the draft is in the
 * cookie, and the query carries two codes.
 *
 * **303, not 307.** Both outcomes are followed by a GET, so a reload of the mode screen cannot
 * re-post stage 1 — the same rule the create endpoint follows.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { serializeCreateDraft, whoDraft } from "@/lib/flow/create-draft";
import {
  CREATE_DRAFT_COOKIE_MAX_AGE,
  createDraftCookieName,
  flowCookieOptions,
} from "@/lib/flow/session";
import { createModePath, createRelationshipPath, TEMPLATE_LIBRARY_PATH } from "@/lib/flow/paths";

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData();
  const value = (name: string) => String(form.get(name) ?? "");
  const templateRecordId = value("templateRecordId").trim();
  const step = whoDraft(value);

  if (!step.ok) {
    // A post that named no template has no screen to return to; the library lists what can be
    // copied, which is the honest answer to "start over".
    const back =
      templateRecordId === "" ? TEMPLATE_LIBRARY_PATH : createRelationshipPath(templateRecordId);
    const target = new URL(back, request.url);
    target.searchParams.set("problem", step.problem.reason);
    target.searchParams.set("field", step.problem.field);
    return NextResponse.redirect(target, 303);
  }

  if (templateRecordId === "") {
    return NextResponse.redirect(new URL(TEMPLATE_LIBRARY_PATH, request.url), 303);
  }

  const jar = await cookies();
  jar.set(
    createDraftCookieName(templateRecordId),
    serializeCreateDraft(step.draft),
    flowCookieOptions(CREATE_DRAFT_COOKIE_MAX_AGE),
  );

  return NextResponse.redirect(new URL(createModePath(templateRecordId), request.url), 303);
}
