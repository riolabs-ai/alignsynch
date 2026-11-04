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
 * **Refusals are codes plus the server's sentence.** `ActRefused` (a reason under eight characters,
 * a role below the floor), `MemberTemplateRefused` (not yours, archived, not a template) and
 * `zAssessment`'s findings all become `{ ok: false }`; anything else is rethrown, because it is not a
 * refusal and a caller must not be told "nothing happened" while the stack is lost.
 *
 * **No `redirect()` and no `revalidatePath()`.** Both member pages are `force-dynamic` and re-read on
 * every visit, and a redirect would swallow the one value a create has to hand back — the new id.
 */
import { ActRefused } from "@/lib/admin/act";
import {
  slugify,
  type TemplateFormPayload,
  type TemplateSaveOutcome,
  validateTemplateRecord,
} from "@/lib/admin/template-draft";
import { currentUser } from "@/lib/auth/session";
import {
  clonePublicTemplate,
  createPrivateTemplate,
  MemberTemplateRefused,
  savePrivateTemplate,
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
      reason: text(payload.reason),
      record: parsed.record,
    });
    return { ok: true, id: result.after.id, actionId: result.actionId };
  } catch (error) {
    return refusalOf(error);
  }
}

/**
 * Clone a public template into one of the member's own.
 *
 * The payload is the source's id and the reason — no record at all, because the copy is taken from
 * the **stored** rows inside the transaction. A body that carried a record would be able to copy
 * words the catalogue never offered.
 */
export async function clonePublic(payload: {
  templateId?: string;
  reason?: string;
}): Promise<TemplateSaveOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const templateId = text(payload.templateId);
  if (templateId === "") return { ok: false, code: "no-such-template" };

  try {
    const result = await clonePublicTemplate({
      actorUserId: user.userId,
      reason: text(payload.reason),
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
      reason: text(payload.reason),
      record: parsed.record,
    });
    return { ok: true, id: result.after.id, actionId: result.actionId };
  } catch (error) {
    return refusalOf(error);
  }
}
