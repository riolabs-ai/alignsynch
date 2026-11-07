"use server";

/**
 * Template authoring, as four server actions (#502a, #502b).
 *
 * Two of them write a **draft** (`createTemplate`, `saveTemplate`); two publish and withdraw it
 * (`publishTemplateVersion`, `unpublishTemplateVersion`). All four reach `act()` and land their own
 * `admin_action` row, but only three name a reason: `createTemplate`, publish and withdraw are
 * privileged acts — a catalogue row is opened, a version goes live — so the person performing them
 * states why. `saveTemplate` does not (#625): its sentence is composed from the record by
 * `lib/member/template-reasons.ts`, exactly as a member's create, clone and save are, so no save on
 * either surface can answer `reason-too-short`.
 *
 * The component posts **the record it is editing** — a plain JSON body — and a create adds a
 * reason. This file
 * resolves who is asking, forces the two fields the console does not own (`type`, `status`), and
 * then asks `zAssessment` whether that body is a template. Every decision worth testing lives
 * further down: the schema decides what a template is, `act()` decides whether this actor may
 * write and writes the audit row in the same transaction. This file is the boundary, not the
 * policy.
 *
 * A publish is the exception to "the component posts the record": it posts only the id and the
 * reason, because it snapshots the **stored** rows. Publishing the form would let an unsaved edit
 * become a version, which is the one thing the immutable row is for.
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
import {
  createTemplateDraft,
  publishTemplate,
  TemplateRefused,
  unpublishTemplate,
  updateTemplateDraft,
} from "@/lib/admin/templates";
import {
  slugify,
  type TemplateCreatePayload,
  type TemplateFormPayload,
  type TemplateSaveOutcome,
  type TemplateVersionFormPayload,
  type TemplateVersionOutcome,
  validateTemplateRecord,
} from "@/lib/admin/template-draft";
import { ADMIN_TEMPLATES_PATH } from "@/lib/admin/paths";
import { requireAdmin } from "@/lib/auth/require-role";
import { currentUser } from "@/lib/auth/session";
import { templateWriteReason } from "@/lib/member/template-reasons";

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
export async function createTemplate(payload: TemplateCreatePayload): Promise<TemplateSaveOutcome> {
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

/** Edit a draft or a published template; an archived row is refused. */
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
      reason: templateWriteReason({
        action: "saved",
        scope: "console",
        title: parsed.record.title,
      }),
      record: parsed.record,
    });
    return { ok: true, id: result.after.id, actionId: result.actionId };
  } catch (error) {
    return refusalOf(error);
  }
}

/** One place both version actions map a thrown refusal, so the two cannot answer differently. */
function versionRefusalOf(error: unknown): TemplateVersionOutcome {
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

/**
 * Publish the **stored** working copy as the next immutable version (#502b).
 *
 * The body carries an id and a reason, and no record: publishing writes what is in the database, not
 * what is in the form. That is the whole difference between a save and a publish — a save is the
 * author's edit, a publish is a snapshot of it — and it means an operator who typed into the editor
 * and clicked publish without saving gets the stored version published, not a half-typed one.
 *
 * The validator runs inside the transaction over the rows it read (`publishTemplate`), through the
 * same `validateTemplateRecord()` a save uses, so an invalid row is refused with the field named and
 * no version row is written.
 */
export async function publishTemplateVersion(
  payload: TemplateVersionFormPayload,
): Promise<TemplateVersionOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };
  await requireAdmin({ next: ADMIN_TEMPLATES_PATH });

  const templateId = text(payload.templateId);
  if (templateId === "") return { ok: false, code: "no-such-template" };

  try {
    const result = await publishTemplate({
      actorUserId: user.userId,
      reason: text(payload.reason),
      templateId,
    });
    return { ok: true, version: result.after.version ?? 0, actionId: result.actionId };
  } catch (error) {
    return versionRefusalOf(error);
  }
}

/**
 * Withdraw a published template from the catalogue (#502b) — a status write, no version deleted.
 *
 * The same shape as a publish, and for the same reason: the reason is the audit row's sentence and
 * the id is the only other input. A row that was not published is refused (`not-published`) rather
 * than silently left alone.
 */
export async function unpublishTemplateVersion(
  payload: TemplateVersionFormPayload,
): Promise<TemplateVersionOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };
  await requireAdmin({ next: ADMIN_TEMPLATES_PATH });

  const templateId = text(payload.templateId);
  if (templateId === "") return { ok: false, code: "no-such-template" };

  try {
    const result = await unpublishTemplate({
      actorUserId: user.userId,
      reason: text(payload.reason),
      templateId,
    });
    return { ok: true, version: result.after.version ?? 0, actionId: result.actionId };
  } catch (error) {
    return versionRefusalOf(error);
  }
}
