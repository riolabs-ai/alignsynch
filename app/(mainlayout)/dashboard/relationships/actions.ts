"use server";

/**
 * The initiator's relationships, as four server actions (#533 phase 2).
 *
 * `createRelationship`, `saveAspects`, `publishRelationship` and `republishInvite`. Each ends in an
 * `act()` write inside `lib/member/relationships.ts` — `relationship.create`, `.aspects`, `.publish`
 * and `.republish`, all floored at `member` — so each leaves an `admin_action` row with the actor's
 * reason in the same transaction as the change.
 *
 * **What this file adds on top of the library, and nothing else.**
 *
 *   - the actor, from `currentUser()` — never a field in a payload, so a crafted post cannot act as
 *     somebody else (the library re-checks ownership under the row lock anyway);
 *   - the **initiator's name**, from the session: the seat the publish opens is theirs, and a body
 *     that could name it could name anybody;
 *   - the **checkout return url**, from this deployment's own base rather than the request's — the
 *     same `NEXT_PUBLIC_BASE_URL` the invitation link is built from, so a preview sends a browser
 *     back to the preview;
 *   - the mapping from a thrown refusal to a code the screen has a sentence for.
 *
 * **A refused publish is a `{ ok: false }`, including the one #533 asks to be pasted.** A trial
 * that is already running carries the server's sentence with the trial's last instant in it, so the
 * screen shows the refusal rather than a disabled button that explains nothing.
 *
 * **A checkout that has not completed is not a failure.** `MemberCheckoutRequired` carries the url
 * the browser must visit; nothing was written, the relationship is still `pending`, and publish is
 * one click again once the account is entitled. The screen draws it as a link, not as an error.
 */
import { ActRefused } from "@/lib/admin/act";
import { validateTemplateRecord } from "@/lib/admin/template-draft";
import { currentUser } from "@/lib/auth/session";
import { BillingRefusal } from "@/lib/billing/port";
import { baseUrl } from "@/lib/flow/email";
import {
  createRelationship,
  MemberCheckoutRequired,
  publishRelationship,
  republishRelationship,
  saveAspects,
  MEMBER_RELATIONSHIPS_PATH,
} from "@/lib/member/relationships";
import { MemberRefused } from "@/lib/member/publish-basis";
import {
  capturePaymentMethod,
  completeRelationship,
  MemberPaymentRequired,
  captureReturnPath,
} from "@/lib/member/payment";
import type {
  AspectsOutcome,
  CompleteOutcome,
  PublishOutcome,
  RelationshipCreateOutcome,
  RepublishOutcome,
} from "@/lib/member/outcomes";

/** A payload field as a trimmed string; anything else is empty, so a refusal names the hole. */
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Where a hosted checkout returns to: this relationship's screen, on this deployment. */
function returnUrlFor(relationshipId: string): string {
  return `${baseUrl().replace(/\/+$/, "")}${MEMBER_RELATIONSHIPS_PATH}/${relationshipId}`;
}

/** Start a relationship from one of the member's templates. */
export async function createRelationshipAction(payload: {
  templateId?: string;
  reason?: string;
}): Promise<RelationshipCreateOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const templateId = text(payload.templateId);
  if (templateId === "") return { ok: false, code: "no-such-template" };

  try {
    const result = await createRelationship({
      actorUserId: user.userId,
      reason: text(payload.reason),
      templateId,
    });
    return { ok: true, id: result.after.relationshipId, actionId: result.actionId };
  } catch (error) {
    if (error instanceof ActRefused) return { ok: false, code: error.reason };
    if (error instanceof MemberRefused) {
      return { ok: false, code: error.reason, message: error.message };
    }
    throw error;
  }
}

/**
 * Save the relationship's Aspects, and optionally mark it ready.
 *
 * `saveAs` is a closed value: `"draft"` keeps it a draft (or reopens a pending one), `"pending"` is
 * the "saved and waiting" state #533 names. Anything else is treated as `"draft"` — the less
 * committing of the two, so a crafted value cannot publish anything.
 */
export async function saveAspectsAction(payload: {
  relationshipId?: string;
  record?: unknown;
  reason?: string;
  saveAs?: string;
}): Promise<AspectsOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const relationshipId = text(payload.relationshipId);
  if (relationshipId === "") return { ok: false, code: "no-such-relationship" };

  const posted = payload.record;
  if (typeof posted !== "object" || posted === null || Array.isArray(posted)) {
    return { ok: false, code: "invalid-draft" };
  }
  // `type` and `status` are the record's own facts, never a control: the copy's status is `draft`
  // and its type is an assessment, and a body that says otherwise is refused by the schema.
  const body: Record<string, unknown> = {
    ...(posted as Record<string, unknown>),
    type: "assessment",
    status: "draft",
  };
  const parsed = validateTemplateRecord(body);
  if (!parsed.ok) return { ok: false, code: "invalid-draft", problems: parsed.problems };

  try {
    const result = await saveAspects({
      actorUserId: user.userId,
      reason: text(payload.reason),
      relationshipId,
      record: parsed.record,
      saveAs: payload.saveAs === "pending" ? "pending" : "draft",
    });
    return { ok: true, status: result.after.status, actionId: result.actionId };
  } catch (error) {
    if (error instanceof ActRefused) return { ok: false, code: error.reason };
    if (error instanceof MemberRefused) {
      return { ok: false, code: error.reason, message: error.message };
    }
    throw error;
  }
}

/** Publish: trial or checkout, `→ published`, the session opened and the invitation minted. */
export async function publishRelationshipAction(payload: {
  relationshipId?: string;
  counterpartyName?: string;
  email?: string;
  reason?: string;
}): Promise<PublishOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const relationshipId = text(payload.relationshipId);
  if (relationshipId === "") return { ok: false, code: "no-such-relationship" };

  try {
    const result = await publishRelationship({
      actorUserId: user.userId,
      reason: text(payload.reason),
      relationshipId,
      // The seat's name and address are the session's, never the body's: the invitation is *from*
      // this person, and a form field that could set them could make the email come from anybody.
      initiatorName: user.name,
      initiatorEmail: user.email ?? null,
      counterpartyName: text(payload.counterpartyName),
      email: text(payload.email),
      returnUrl: returnUrlFor(relationshipId),
    });
    return {
      ok: true,
      actionId: result.actionId,
      status: result.after.status,
      inviteLink: result.after.inviteLink,
      inviteExpiresAt: result.after.inviteExpiresAt,
      trialEndsAt: result.after.trialEndsAt,
    };
  } catch (error) {
    if (error instanceof MemberCheckoutRequired) {
      return { ok: false, code: "checkout-required", url: error.url };
    }
    if (error instanceof BillingRefusal) {
      // The adapter's own sentence: no keys, a tier that is not for sale. Not a refusal this screen
      // can improve on, so it is passed through with its code.
      return { ok: false, code: error.code, message: error.message };
    }
    if (error instanceof ActRefused) return { ok: false, code: error.reason };
    if (error instanceof MemberRefused) {
      return { ok: false, code: error.reason, message: error.message };
    }
    throw error;
  }
}

/** Reissue a lapsed or revoked invitation — one click, and the Aspects are not re-entered. */
export async function republishInviteAction(payload: {
  relationshipId?: string;
  reason?: string;
}): Promise<RepublishOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const relationshipId = text(payload.relationshipId);
  if (relationshipId === "") return { ok: false, code: "no-such-relationship" };

  try {
    const result = await republishRelationship({
      actorUserId: user.userId,
      reason: text(payload.reason),
      relationshipId,
    });
    return {
      ok: true,
      actionId: result.actionId,
      inviteLink: result.after.inviteLink,
      inviteExpiresAt: result.after.inviteExpiresAt,
    };
  } catch (error) {
    if (error instanceof ActRefused) return { ok: false, code: error.reason };
    if (error instanceof MemberRefused) {
      return { ok: false, code: error.reason, message: error.message };
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ *
 * #619 — pay to complete: the capture and the completion
 * ------------------------------------------------------------------ */

/**
 * Put a payment method on this relationship — the "pay now / later" half.
 *
 * Nothing is charged and nothing is unlocked: this only makes the completion possible. The route a
 * hosted adapter sends the browser to is this deployment's own return endpoint, which resolves the
 * provider's session before landing the payer back on the relationship.
 */
export async function capturePaymentMethodAction(payload: {
  relationshipId?: string;
  reason?: string;
}): Promise<{ ok: true; url: string | null } | { ok: false; code: string; message?: string }> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const relationshipId = text(payload.relationshipId);
  if (relationshipId === "") return { ok: false, code: "no-such-relationship" };

  try {
    const result = await capturePaymentMethod({
      actorUserId: user.userId,
      relationshipId,
      returnUrl: `${baseUrl().replace(/\/+$/, "")}${captureReturnPath(relationshipId)}`,
      email: user.email ?? undefined,
    });
    return { ok: true, url: result.url };
  } catch (error) {
    if (error instanceof MemberRefused) {
      return { ok: false, code: error.reason, message: error.message };
    }
    if (error instanceof BillingRefusal) {
      return { ok: false, code: error.code, message: error.message };
    }
    throw error;
  }
}

/**
 * Take the fee and complete the relationship — the payer's one act.
 *
 * Two outcomes that are not failures: `payment-method-required` carries the url of a capture that
 * has to happen first (nothing was charged, the sheets stay sealed), and a declined card answers
 * `charge-declined` with the provider's sentence, which the retry ladder is already handling.
 *
 * The actor and the price are not the body's: the payer is the session's account and the fee is
 * `data/billing-plans.ts`'s amount for the tier the call names — the library compares both against
 * the relationship's own row under the lock.
 */
export async function completeRelationshipAction(payload: {
  relationshipId?: string;
  planId?: string;
  reason?: string;
}): Promise<CompleteOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const relationshipId = text(payload.relationshipId);
  if (relationshipId === "") return { ok: false, code: "no-such-relationship" };
  const reason = text(payload.reason);
  const planId = text(payload.planId);

  try {
    const result = await completeRelationship({
      actorUserId: user.userId,
      relationshipId,
      reason: reason === "" ? "publish the assessment and take the relationship fee" : reason,
      ...(planId === "" ? {} : { planId }),
      returnUrl: `${baseUrl().replace(/\/+$/, "")}${captureReturnPath(relationshipId)}`,
      email: user.email ?? undefined,
    });
    return {
      ok: true,
      actionId: result.actionId,
      status: result.after.status,
      chargedAt: result.after.chargedAt,
      amountCents: result.after.amountCents,
    };
  } catch (error) {
    if (error instanceof MemberPaymentRequired) {
      // Not a refusal: the browser has somewhere to go, and no state changed.
      return { ok: false, code: "payment-method-required", url: error.url };
    }
    if (error instanceof MemberRefused) {
      return { ok: false, code: error.reason, message: error.message };
    }
    if (error instanceof BillingRefusal) {
      return { ok: false, code: error.code, message: error.message };
    }
    if (error instanceof ActRefused) return { ok: false, code: error.reason };
    throw error;
  }
}
