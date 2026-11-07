"use server";

/**
 * The five relationship repairs, as one server action (#503).
 *
 * `components/admin/relationship-operations.tsx` posts one of five names here, with a reason and —
 * for two of them — a seat or an address. Everything that decides whether the repair may happen is
 * downstream of this function: `lib/admin/relationship-ops.ts` asks `act()`, and `act()` reads the
 * actor's role out of `user_profile` inside the transaction it writes. This file only resolves
 * **who is asking** and **which repair they named**.
 *
 * **The actor comes from the session, never from the body.** `currentUser()` resolves it from the
 * request's cookies on the server; a payload that named a `userId` would be a caller choosing whose
 * audit row it gets, and there is no field for one.
 *
 * **The action name is a closed union, not a string handed to a function table.** `REPAIRS` maps
 * each operand the client may use to one function in `lib/admin/relationship-ops.ts`; an unknown
 * name is a refusal this file returns rather than an `undefined is not a function` deep inside a
 * transaction.
 *
 * **Refusals come back as data.** `ActRefused` (short reason, low role, unknown action or target)
 * and `OpRefused` (the row cannot do what was asked) both map to `{ ok: false, code }`, and the
 * screen draws the sentence from its own fixture. A genuine failure — a database that dropped, a
 * bug — is rethrown: it is not a refusal, and the caller must not be told "nothing happened" by a
 * code while the stack is lost.
 *
 * **No `redirect()` and no `revalidatePath()`.** The screen is `force-dynamic` and the page re-reads
 * on every visit, and a redirect would swallow the one value a resend has to hand back: the new
 * invitation link. The action returns it once; the component holds it in state and says so.
 */
import { currentUser } from "@/lib/auth/session";
import { ActRefused } from "@/lib/admin/act";
import { OpRefused } from "@/lib/admin/relationship-ops";
import { validateTemplateRecord } from "@/lib/admin/template-draft";
import { queryRows } from "@/lib/db/client";
import { editRelationship, previewRelationshipEdit } from "@/lib/member/relationship-edit";
import { MemberRefused } from "@/lib/member/publish-basis";
import type { EditOutcome, EditPreviewOutcome } from "@/lib/member/outcomes";
import type { EditDraft } from "@/lib/relationship/edit-view";
import {
  forceCloseSeat,
  resendInvite,
  revokeInvite,
  unlockParty,
  voidSession,
} from "@/lib/admin/relationship-ops";
import type { RepairInput, RepairOutcome } from "@/lib/admin/repairs";
import { invitationLink } from "@/lib/flow/email";
import type { PartyRole } from "@/content/assessment";

/**
 * The repair names, the request shape and the outcome shape live in `lib/admin/repairs.ts`: a
 * `"use server"` module may export only async functions, and a `REPAIR_NAMES` array here fails the
 * build at "collecting configuration" for this route. Re-exported as a *type* only, which is the
 * one thing the directive allows.
 */
export type { RepairInput, RepairOutcome } from "@/lib/admin/repairs";

/**
 * #623 — the console's edit of somebody else's relationship.
 *
 * The URL names the *session* record, and every edit is a relationship-level write, so the id is
 * resolved here (`session.relationship_id`) rather than guessed from the string. `audience:
 * "staff"` is what makes the library accept a row whose `initiator_user_id` is somebody else — and
 * it reads the actor's rung out of `user_profile` inside the same transaction, so a member who
 * posts this action is refused there rather than here.
 */
export async function editRelationshipAsStaff(input: {
  instanceRecordId?: string;
  record?: unknown;
  versionId?: string | null;
  counterpartyName?: string;
  counterpartyEmail?: string;
  inviteDays?: number;
  reason?: string;
  confirm?: boolean;
}): Promise<EditOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const instanceRecordId =
    typeof input?.instanceRecordId === "string" ? input.instanceRecordId : "";
  if (instanceRecordId === "") return { ok: false, code: "no-such-relationship" };

  const relationshipId = await relationshipIdOf(instanceRecordId);
  if (relationshipId === null) return { ok: false, code: "no-such-relationship" };

  const draft = await draftOf(input, relationshipId);
  if (!draft.ok) return draft;

  try {
    const result = await editRelationship({
      actorUserId: user.userId,
      relationshipId,
      audience: "staff",
      reason: text(input.reason) || "edit the relationship from the console",
      draft: draft.value,
      confirmInvalidation: input.confirm === true,
    });
    return {
      ok: true,
      actionId: result.actionId,
      status: result.after.status,
      version: result.after.version,
      discardedAnswers: result.after.discardedAnswers,
    };
  } catch (error) {
    if (error instanceof ActRefused) return { ok: false, code: error.reason };
    if (error instanceof MemberRefused) {
      return { ok: false, code: error.reason, message: error.message };
    }
    throw error;
  }
}

/** #623 — the same cost question, asked by the console before an operator commits a change. */
export async function previewRelationshipEditAsStaff(input: {
  instanceRecordId?: string;
  record?: unknown;
  versionId?: string | null;
  counterpartyName?: string;
  counterpartyEmail?: string;
  inviteDays?: number;
}): Promise<EditPreviewOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const instanceRecordId =
    typeof input?.instanceRecordId === "string" ? input.instanceRecordId : "";
  if (instanceRecordId === "") return { ok: false, code: "no-such-relationship" };

  const relationshipId = await relationshipIdOf(instanceRecordId);
  if (relationshipId === null) return { ok: false, code: "no-such-relationship" };

  const draft = await draftOf(input, relationshipId);
  if (!draft.ok) return draft;

  try {
    const preview = await previewRelationshipEdit({
      actorUserId: user.userId,
      relationshipId,
      audience: "staff",
      draft: draft.value,
    });
    return {
      ok: true,
      blocked: preview.blocked,
      invalidations: preview.invalidations,
      state: preview.state,
    };
  } catch (error) {
    if (error instanceof ActRefused) return { ok: false, code: error.reason };
    if (error instanceof MemberRefused) {
      return { ok: false, code: error.reason, message: error.message };
    }
    throw error;
  }
}

/** The relationship a console session belongs to, or `null` for an id this app does not audit. */
async function relationshipIdOf(instanceRecordId: string): Promise<string | null> {
  const rows = await queryRows<{ relationship_id: string }>(
    `SELECT s.relationship_id FROM session s
       JOIN record r ON r.id = s.record_id
      WHERE s.record_id = $1 AND r.record_type = 'assessment'`,
    [instanceRecordId],
  );
  return rows[0]?.relationship_id ?? null;
}

/** The posted record, validated exactly as a save validates it — one validator, one answer. */
async function draftOf(
  input: {
    record?: unknown;
    versionId?: string | null;
    counterpartyName?: string;
    counterpartyEmail?: string;
    inviteDays?: number;
  },
  relationshipId: string,
): Promise<{ ok: true; value: EditDraft } | { ok: false; code: string; message?: string }> {
  const posted = input?.record;
  if (typeof posted !== "object" || posted === null || Array.isArray(posted)) {
    return { ok: false, code: "invalid-draft" };
  }
  const body: Record<string, unknown> = {
    ...(posted as Record<string, unknown>),
    type: "assessment",
    status: "draft",
  };
  const parsed = validateTemplateRecord(body);
  if (!parsed.ok) {
    return {
      ok: false,
      code: "invalid-draft",
      message: parsed.problems.map((problem) => `${problem.path}: ${problem.message}`).join("; "),
    };
  }
  const relationship = await queryRows<{ template_id: string }>(
    "SELECT template_id FROM relationship WHERE id = $1",
    [relationshipId],
  );
  const templateId = relationship[0]?.template_id;
  if (templateId === undefined) return { ok: false, code: "no-such-relationship" };
  return {
    ok: true,
    value: {
      record: { ...parsed.record, id: templateId },
      versionId: input.versionId ?? null,
      ...(input.counterpartyName === undefined
        ? {}
        : { counterpartyName: text(input.counterpartyName) }),
      ...(input.counterpartyEmail === undefined
        ? {}
        : { counterpartyEmail: text(input.counterpartyEmail) }),
      ...(input.inviteDays === undefined ? {} : { inviteDays: input.inviteDays }),
    },
  };
}

/** A payload field as a trimmed string; anything else is empty, so a refusal names the hole. */
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The seat a repair names, or `null` for anything that is not one of the two roles. */
function seatOf(value: string | undefined): PartyRole | null {
  return value === "initiator" || value === "counterparty" ? value : null;
}

/**
 * Run one repair for the signed-in operator.
 *
 * A `role` that is neither seat is refused with `no-such-party`: the payload's own mistake, named
 * with the code the screen already has a sentence for.
 */
export async function performRepair(input: RepairInput): Promise<RepairOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const reason = typeof input?.reason === "string" ? input.reason : "";
  const instanceRecordId =
    typeof input?.instanceRecordId === "string" ? input.instanceRecordId : "";
  const actorUserId = user.userId;
  const base = { actorUserId, instanceRecordId, reason };

  try {
    switch (input?.repair) {
      case "unlock": {
        const role = seatOf(input.role);
        if (role === null) return { ok: false, code: "no-such-party" };
        const result = await unlockParty({ ...base, role });
        return { ok: true, action: "party.unlock", actionId: result.actionId };
      }
      case "resend": {
        const result = await resendInvite({ ...base, email: input.email ?? null });
        return {
          ok: true,
          action: "invite.resend",
          actionId: result.actionId,
          // The link, exactly once. `invitationLink()` is the same builder the flow's own
          // invitation uses, so an operator's link and a party's are one shape.
          link: invitationLink(result.after.token),
          email: result.after.email,
        };
      }
      case "revoke": {
        const result = await revokeInvite(base);
        return { ok: true, action: "invite.revoke", actionId: result.actionId };
      }
      case "void": {
        const result = await voidSession(base);
        return { ok: true, action: "session.void", actionId: result.actionId };
      }
      case "force-close": {
        const role = seatOf(input.role);
        if (role === null) return { ok: false, code: "no-such-party" };
        const result = await forceCloseSeat({ ...base, role });
        return { ok: true, action: "instance.force-close", actionId: result.actionId };
      }
      default:
        return { ok: false, code: "failed" };
    }
  } catch (error) {
    if (error instanceof ActRefused) return { ok: false, code: error.reason };
    if (error instanceof OpRefused) return { ok: false, code: error.reason };
    throw error;
  }
}
