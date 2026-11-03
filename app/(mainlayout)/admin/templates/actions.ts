"use server";

/**
 * Template authoring, as two server actions (#502a).
 *
 * The component posts **the record it is editing** — a plain JSON body — plus a reason. This file
 * resolves who is asking, forces the two fields the console does not own (`type`, `status`), and
 * then asks `zAssessment` whether that body is a template. Every decision worth testing lives
 * further down: the schema decides what a template is, `act()` decides whether this actor may
 * write and writes the audit row in the same transaction. This file is the boundary, not the
 * policy.
 *
 * **The body is parsed, not re-assembled.** That is the difference the card asks for: an unknown
 * key a crafted post carries (`opinionKind`, `correctOptionId`, `opinions`) reaches the schema's
 * `.strict()` and is refused **with its name**, instead of being dropped by a reader that only
 * copies the fields it knows. The console's own form builds its body with
 * `buildTemplateRecord()`; both paths end at the same `zAssessment`.
 *
 * **`type` and `status` are forced.** A template this console writes is an assessment draft:
 * `zAssessment` already refuses any other `type`, and `status` is `draft` until #502b's versioned
 * publish. Forcing them before validation means a crafted body cannot open a published row
 * through the create path; the update path refuses a published row anyway (`not-editable`).
 *
 * **The actor never travels in the payload.** `currentUser()` reads the session server-side, so a
 * crafted body cannot name whose `admin_action` row it gets — there is no field for one.
 *
 * **Refusals are codes, plus zod's own paths.** `ActRefused` and `TemplateRefused` come back as
 * `{ ok: false }`, and the screen draws the sentence from its fixture. A genuine failure is
 * rethrown: it is not a refusal, and a caller must not be told "nothing happened" while the stack
 * is lost.
 *
 * **No `redirect()`/`revalidatePath()`.** Both pages are `force-dynamic` and re-read on every
 * visit; a redirect would also swallow the one value a save has to hand back — the new id.
 */
import { ActRefused } from "@/lib/admin/act";
import { createTemplateDraft, TemplateRefused, updateTemplateDraft } from "@/lib/admin/templates";
import {
  slugify,
  type TemplateFormPayload,
  type TemplateSaveOutcome,
  validateTemplateRecord,
} from "@/lib/admin/template-draft";
import { ADMIN_TEMPLATES_PATH } from "@/lib/admin/paths";
import { requireAdmin } from "@/lib/auth/require-role";
import { currentUser } from "@/lib/auth/session";

/** A payload field as a trimmed string; anything else is empty, so zod names the hole. */
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The body as the record the schema will judge.
 *
 * `create` derives the identity the create form does not ask for — `slug` from the title and `id`
 * as `assessment-<slug>` — because a template needs one and the operator typed a name, not a key.
 * The edit path keeps the record's own id and the page supplies its slug and date.
 */
function bodyOf(payload: TemplateFormPayload, create: boolean): Record<string, unknown> | null {
  const posted = payload.record;
  if (typeof posted !== "object" || posted === null || Array.isArray(posted)) return null;
  const body: Record<string, unknown> = { ...(posted as Record<string, unknown>) };

  body.type = "assessment";
  body.status = "draft";
  if (create) {
    const slug = text(body.slug) || slugify(text(body.title));
    body.slug = slug;
    if (text(body.id) === "") body.id = `assessment-${slug}`;
    if (text(body.date) === "") body.date = new Date().toISOString();
  }
  return body;
}

/** One place both actions map a thrown refusal, so the two cannot answer differently. */
function refusalOf(error: unknown): TemplateSaveOutcome {
  if (error instanceof ActRefused) return { ok: false, code: error.reason };
  if (error instanceof TemplateRefused) {
    return {
      ok: false,
      code: error.reason,
      ...(error.problems.length > 0 ? { problems: error.problems } : {}),
    };
  }
  throw error;
}

/** Create a draft, and answer with its id so the screen can open it. */
export async function createTemplate(payload: TemplateFormPayload): Promise<TemplateSaveOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };
  // The gate again, on the action: hiding a form is not enforcement.
  await requireAdmin({ next: ADMIN_TEMPLATES_PATH });

  const body = bodyOf(payload, true);
  if (body === null) return { ok: false, code: "invalid-draft" };

  const parsed = validateTemplateRecord(body);
  if (!parsed.ok) return { ok: false, code: "invalid-draft", problems: parsed.problems };

  try {
    const result = await createTemplateDraft({
      actorUserId: user.userId,
      reason: text(payload.reason),
      record: parsed.record,
    });
    return { ok: true, id: result.after.id, actionId: result.actionId };
  } catch (error) {
    return refusalOf(error);
  }
}

/** Edit a draft. A published row is refused as `not-editable` — publishing is #502b. */
export async function saveTemplate(payload: TemplateFormPayload): Promise<TemplateSaveOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };
  await requireAdmin({ next: ADMIN_TEMPLATES_PATH });

  const body = bodyOf(payload, false);
  if (body === null) return { ok: false, code: "invalid-draft" };
  if (text(body.id) === "") return { ok: false, code: "no-such-template" };

  const parsed = validateTemplateRecord(body);
  if (!parsed.ok) return { ok: false, code: "invalid-draft", problems: parsed.problems };

  try {
    const result = await updateTemplateDraft({
      actorUserId: user.userId,
      reason: text(payload.reason),
      record: parsed.record,
    });
    return { ok: true, id: result.after.id, actionId: result.actionId };
  } catch (error) {
    return refusalOf(error);
  }
}
