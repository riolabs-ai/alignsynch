"use server";

/**
 * The member's own templates, as three server actions (#533 phase 2).
 *
 * `createPrivate`, `clonePublic` and `savePrivate` are the only ways a member's template row comes
 * into being or changes, and all three end in an `act()` write (`template.draft`) inside
 * `lib/member/templates.ts`. This file is the boundary, not the policy:
 *
 *   - **the actor is the session's**, read server-side by `currentUser()`. There is no field in any
 *     payload that names a user, so a crafted body cannot author a template for somebody else;
 *   - **the record is parsed, not re-assembled** — `zAssessment` sees the body the form posted,
 *     unknown keys included, so a key the model does not carry is refused with its name;
 *   - **the fields a member does not own are forced**: `type`, `status`, and — for a create — the
 *     id and the slug. `visibility`, `owner_user_id` and `author_user_id` never reach the schema at
 *     all; the SQL in `lib/member/templates.ts` writes `private` and the actor's id, which is what
 *     makes "members can never create a public template" a statement rather than a hidden input.
 *
 * **Refusals are codes plus the server's sentence.** `ActRefused` (a role below the floor),
 * `MemberTemplateRefused` (not yours, archived, not a template) and `zAssessment`'s findings all
 * become `{ ok: false }`; anything else is rethrown, because it is not a refusal and a caller must
 * not be told "nothing happened" while the stack is lost. `reason-too-short` is absent on purpose:
 * all three actions compose their audit sentence server-side (#625), so no field a person was never
 * shown can refuse the write.
 *
 * **No `redirect()` and no `revalidatePath()`.** Both member pages are `force-dynamic` and re-read on
 * every visit, and a redirect would swallow the one value a create has to hand back — the new id.
 */
import { ActRefused } from "@/lib/admin/act";
import {
  slugify,
  type TemplateFormPayload,
  type TemplateSaveOutcome,
  type TemplateVersionFormPayload,
  type TemplateVersionOutcome,
  validateTemplateRecord,
} from "@/lib/admin/template-draft";
import { currentUser } from "@/lib/auth/session";
import { templateWriteReason, type TemplateWriteAction } from "@/lib/member/template-reasons";
import {
  archiveMyTemplate,
  clonePublicTemplate,
  createPrivateTemplate,
  deleteMyTemplate,
  MemberTemplateRefused,
  restoreMyTemplate,
  savePrivateTemplate,
  type MemberTemplateRetireRequest,
} from "@/lib/member/templates";

/** A payload field as a trimmed string; anything else is empty, so zod names the hole. */
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** A record id for a row that does not exist yet: a token, so it cannot collide with a fixture id. */
function freshTemplateId(): string {
  return `member-template-${Math.random().toString(16).slice(2, 8)}${Math.random()
    .toString(16)
    .slice(2, 8)}`;
}

/** One place every action maps a thrown refusal, so none of them can answer differently. */
function refusalOf(error: unknown): TemplateSaveOutcome {
  if (error instanceof ActRefused) return { ok: false, code: error.reason };
  if (error instanceof MemberTemplateRefused) return { ok: false, code: error.reason };
  throw error;
}

/**
 * The body as the record the schema will judge.
 *
 * `create` derives the two fields the form does not ask for: the id (a fresh token, because the
 * audit row's target has to exist before the transaction opens) and the slug (from the title, with
 * `freeSlug` appending a suffix inside the transaction if the name is taken). The edit path keeps
 * the record's own id and slug, which the form carries from the row it read.
 */
function bodyOf(payload: { record?: unknown }, create: boolean): Record<string, unknown> | null {
  const posted = payload.record;
  if (typeof posted !== "object" || posted === null || Array.isArray(posted)) return null;
  const body: Record<string, unknown> = { ...(posted as Record<string, unknown>) };

  body.type = "assessment";
  body.status = "draft";
  if (create) {
    body.id = freshTemplateId();
    body.slug = slugify(text(body.title));
    if (text(body.date) === "") body.date = new Date().toISOString();
  }
  return body;
}

/** Start a private template from the form's title, summary and first Aspect. */
export async function createPrivate(payload: TemplateFormPayload): Promise<TemplateSaveOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const body = bodyOf(payload, true);
  if (body === null) return { ok: false, code: "invalid-draft" };

  const parsed = validateTemplateRecord(body);
  if (!parsed.ok) return { ok: false, code: "invalid-draft", problems: parsed.problems };

  try {
    const result = await createPrivateTemplate({
      actorUserId: user.userId,
      reason: templateWriteReason({
        action: "created-blank",
        scope: "member",
        title: parsed.record.title,
      }),
      record: parsed.record,
    });
    return { ok: true, id: result.after.id, actionId: result.actionId };
  } catch (error) {
    return refusalOf(error);
  }
}

/**
 * Copy a template into one of the member's own — a catalogue one, or one they already own.
 *
 * The payload is the source's id alone — no record, because the copy is taken from the **stored**
 * rows inside the transaction, and no reason, because the audit sentence is composed here. A body
 * that carried a record would be able to copy words the catalogue never offered.
 *
 * **Two sources, one control** (#1109): the catalogue's published templates, and the member's own.
 * The second is the "duplicate" action the retired `/templates/relationship` row menu offered, and
 * this band is where it lives now. Which of the two a body names is decided by the write, not by
 * this action: it hands the id over and the transaction refuses anything the member may not copy.
 */
export async function clonePublic(payload: { templateId?: string }): Promise<TemplateSaveOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const templateId = text(payload.templateId);
  if (templateId === "") return { ok: false, code: "no-such-template" };

  try {
    const result = await clonePublicTemplate({
      actorUserId: user.userId,
      reason: templateWriteReason({
        action: "copied",
        scope: "member",
        sourceTemplateId: templateId,
      }),
      templateId,
      id: freshTemplateId(),
    });
    return { ok: true, id: result.after.id, actionId: result.actionId };
  } catch (error) {
    return refusalOf(error);
  }
}

/** Edit one of the member's own templates. Ownership is re-checked under the row lock. */
export async function savePrivate(payload: TemplateFormPayload): Promise<TemplateSaveOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const body = bodyOf(payload, false);
  if (body === null) return { ok: false, code: "invalid-draft" };
  if (text(body.id) === "") return { ok: false, code: "no-such-template" };

  const parsed = validateTemplateRecord(body);
  if (!parsed.ok) return { ok: false, code: "invalid-draft", problems: parsed.problems };

  try {
    const result = await savePrivateTemplate({
      actorUserId: user.userId,
      reason: templateWriteReason({ action: "saved", scope: "member", title: parsed.record.title }),
      record: parsed.record,
    });
    return { ok: true, id: result.after.id, actionId: result.actionId };
  } catch (error) {
    return refusalOf(error);
  }
}

/* ------------------------------------------------------------------ *
 * Retire — archive, restore, destroy the member's own template (#1109)
 * ------------------------------------------------------------------ */

/** The one body the three retire actions share, so the fourth one cannot silently lose the gate. */
async function retirePrivate(
  payload: TemplateVersionFormPayload,
  write: (request: MemberTemplateRetireRequest) => Promise<{ readonly actionId: string }>,
  action: Extract<TemplateWriteAction, "archived" | "restored" | "deleted">,
): Promise<TemplateVersionOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const templateId = text(payload.templateId);
  if (templateId === "") return { ok: false, code: "no-such-template" };

  try {
    const result = await write({
      actorUserId: user.userId,
      reason: templateWriteReason({ action, scope: "member", templateId }),
      templateId,
    });
    /**
     * `version: 0` and not a version number: a member's template carries no `template_version` row
     * (publishing to the catalogue is the console's), and this outcome's `version` is the field the
     * retire band does not print. `actionId` is what the notice names, and it is real.
     */
    return { ok: true, version: 0, actionId: result.actionId };
  } catch (error) {
    if (error instanceof ActRefused) return { ok: false, code: error.reason };
    if (error instanceof MemberTemplateRefused) return { ok: false, code: error.reason };
    throw error;
  }
}

/**
 * Archive one of the member's own templates.
 *
 * The retired `/templates/relationship` listing carried this as a row action, and until #1109 it was
 * the only UI for it: the editor's retire band existed but the private page passed no handler.
 */
export async function archivePrivate(
  payload: TemplateVersionFormPayload,
): Promise<TemplateVersionOutcome> {
  return retirePrivate(payload, archiveMyTemplate, "archived");
}

/** Put an archived template back in hand — as a working copy (`draft`), never as an offer. */
export async function restorePrivate(
  payload: TemplateVersionFormPayload,
): Promise<TemplateVersionOutcome> {
  return retirePrivate(payload, restoreMyTemplate, "restored");
}

/**
 * Destroy a template no reader can reach.
 *
 * The destructive one, and the gate is not the dialog: `deleteMyTemplate()` refuses a row any
 * relationship was created from and a row with a published version, and writes nothing when it
 * refuses. The editor's `AlertDialog` is a confirmation, never the rule.
 */
export async function deletePrivate(
  payload: TemplateVersionFormPayload,
): Promise<TemplateVersionOutcome> {
  return retirePrivate(payload, deleteMyTemplate, "deleted");
}
