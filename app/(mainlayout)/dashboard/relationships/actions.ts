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
import {
  validateEditedRecord,
  validateTemplateRecord,
  type EditedRecord,
} from "@/lib/admin/template-draft";
import { currentUser } from "@/lib/auth/session";
import { BillingRefusal } from "@/lib/billing/port";
import { zAlignmentSetting, zAssessmentMode } from "@/content/assessment";
import { baseUrl } from "@/lib/flow/email";
import { forkRelationshipTemplate } from "@/lib/flow/templates";
import {
  createRelationship,
  MemberCheckoutRequired,
  publishRelationship,
  republishRelationship,
  saveAspects,
  MEMBER_RELATIONSHIPS_PATH,
} from "@/lib/member/relationships";
import { editRelationship, previewRelationshipEdit } from "@/lib/member/relationship-edit";
import { MemberRefused } from "@/lib/member/publish-basis";
import type { EditDraft } from "@/lib/relationship/edit-view";
import {
  capturePaymentMethod,
  completeRelationship,
  MemberPaymentRequired,
  captureReturnPath,
  resolveCapturedMethod,
} from "@/lib/member/payment";
import type {
  AspectsOutcome,
  CaptureOutcome,
  CompleteOutcome,
  EditOutcome,
  EditPreviewOutcome,
  ForkOutcome,
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
  /** #623 — the two settings the session opens under; absent keeps `basic`/`soft`. */
  mode?: string;
  setting?: string;
}): Promise<PublishOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const relationshipId = text(payload.relationshipId);
  if (relationshipId === "") return { ok: false, code: "no-such-relationship" };

  const mode = zAssessmentMode.safeParse(payload.mode);
  const setting = zAlignmentSetting.safeParse(payload.setting);
  if (!mode.success || !setting.success) return { ok: false, code: "invalid-draft" };

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
      mode: mode.data,
      setting: setting.data,
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

/**
 * #623 — what an edit would cost, asked before it is written.
 *
 * The same payload as the write, minus the confirmation: a screen cannot decide the cost itself
 * (it would need every party's answer counts, which is a database read it must not do), so the
 * server computes it from the rows and hands back the list plus the state to draw.
 */
export async function previewRelationshipEditAction(payload: {
  relationshipId?: string;
  record?: unknown;
  versionId?: string | null;
  counterpartyName?: string;
  counterpartyEmail?: string;
  inviteDays?: number;
  reason?: string;
}): Promise<EditPreviewOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const relationshipId = text(payload.relationshipId);
  if (relationshipId === "") return { ok: false, code: "no-such-relationship" };

  const parsed = parseEditedRecord(payload.record);
  if (!parsed.ok) return parsed;

  try {
    const preview = await previewRelationshipEdit({
      actorUserId: user.userId,
      relationshipId,
      draft: editDraftOf(parsed.record, payload),
    });
    return {
      ok: true,
      blocked: preview.blocked,
      invalidations: preview.invalidations,
      state: preview.state,
    };
  } catch (error) {
    return previewFailure(error);
  }
}

/**
 * #623 — the write, and it is refused until the cost is confirmed.
 *
 * `confirm` is the person's answer to the list the preview printed. The library recomputes the list
 * from the locked rows and refuses `unconfirmed-invalidation` when it is non-empty and this is not
 * `true` — so a caller that skips the preview gets the refusal rather than a silent discard, and a
 * caller that confirms a list which has since changed gets `unconfirmed-invalidation` again.
 */
export async function editRelationshipAction(payload: {
  relationshipId?: string;
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

  const relationshipId = text(payload.relationshipId);
  if (relationshipId === "") return { ok: false, code: "no-such-relationship" };

  const parsed = parseEditedRecord(payload.record);
  if (!parsed.ok) return parsed;

  try {
    const result = await editRelationship({
      actorUserId: user.userId,
      relationshipId,
      reason: text(payload.reason) || "edit the relationship from its own screen",
      draft: editDraftOf(parsed.record, payload),
      confirmInvalidation: payload.confirm === true,
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

/**
 * #785 — **take the relationship's template into this account's own library.**
 *
 * The Counterparty's one action on a relationship they did not configure: the Aspects they were
 * asked to answer are worth keeping, and `duplicateTemplate` cannot reach them (the relationship's
 * template is a private copy of the initiator's, which no library read lists). The write is
 * `forkRelationshipTemplate`; this file supplies the actor from the session and nothing from the
 * body, exactly as every other action here does — a crafted post cannot fork on somebody's behalf,
 * and the seat the store checks is the session's own.
 *
 * `relationshipId` is taken as posted and re-checked inside the transaction: a screen that did not
 * draw the control is not the enforcement.
 */
export async function forkRelationshipTemplateAction(payload: {
  relationshipId?: string;
  reason?: string;
}): Promise<ForkOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const relationshipId = text(payload.relationshipId);
  if (relationshipId === "") return { ok: false, code: "not-yours" };

  const result = await forkRelationshipTemplate(relationshipId, user.userId);
  if (!result.ok) return { ok: false, code: result.code };

  return {
    ok: true,
    slug: result.template.slug,
    title: result.template.title,
    aspectCount: result.template.aspectCount,
    reused: result.reused,
  };
}

/**
 * The posted record, validated exactly as a save validates it — one validator, one answer.
 *
 * `items` is **optional** here (#943): the relationship's edit dialog draws no Aspect control, so
 * it posts no list, and `validateEditedRecord` is `zAssessment` with that one field allowed to be
 * absent. A body that *does* name a list is held to the same schema — `.min(1)`, the 1..5 scale,
 * two named ends, unique ids — so sending rows is still a checked act rather than an ignored one.
 */
function parseEditedRecord(
  posted: unknown,
): { ok: true; record: EditedRecord } | { ok: false; code: string; message?: string } {
  if (typeof posted !== "object" || posted === null || Array.isArray(posted)) {
    return { ok: false, code: "invalid-draft" };
  }
  // `type` and `status` are the record's own facts, never a control: the copy is a draft
  // assessment, and a body that says otherwise is refused by the schema.
  const body: Record<string, unknown> = {
    ...(posted as Record<string, unknown>),
    type: "assessment",
    status: "draft",
  };
  const parsed = validateEditedRecord(body);
  if (!parsed.ok) {
    return {
      ok: false,
      code: "invalid-draft",
      message: parsed.problems.map((problem) => `${problem.path}: ${problem.message}`).join("; "),
    };
  }
  return { ok: true, record: parsed.record };
}

/** The draft the library takes, from a validated record and the payload's side fields. */
function editDraftOf(
  record: EditedRecord,
  payload: {
    versionId?: string | null;
    counterpartyName?: string;
    counterpartyEmail?: string;
    inviteDays?: number;
  },
): EditDraft {
  return {
    record,
    versionId: payload.versionId ?? null,
    ...(payload.counterpartyName === undefined
      ? {}
      : { counterpartyName: text(payload.counterpartyName) }),
    ...(payload.counterpartyEmail === undefined
      ? {}
      : { counterpartyEmail: text(payload.counterpartyEmail) }),
    ...(payload.inviteDays === undefined ? {} : { inviteDays: payload.inviteDays }),
  };
}

/** A preview's refusals are the member's own codes plus a database-shaped failure. */
function previewFailure(error: unknown): EditPreviewOutcome {
  if (error instanceof ActRefused) return { ok: false, code: error.reason };
  if (error instanceof MemberRefused) {
    return { ok: false, code: error.reason, message: error.message };
  }
  throw error;
}

/* ------------------------------------------------------------------ *
 * #619 — pay to complete: the capture and the completion
 * ------------------------------------------------------------------ */

/**
 * Put a payment method on this relationship — the "pay now / later" half.
 *
 * Nothing is charged and nothing is unlocked: this only makes the completion possible.
 *
 * **Two presentations, chosen by the caller (#748).** `embedded` asks the adapter for a session the
 * screen mounts in a frame, and answers `clientSecret` + `captureSessionId`; nothing navigates, and
 * the frame's completion calls `resolveCaptureAction` below. No `presentation` (or `hosted`) is the
 * path that shipped: the route a hosted adapter sends the browser to is this deployment's own
 * return endpoint, which resolves the provider's session before landing the payer back here. The
 * `presentation` value is a word this module recognises, never one it invents: anything else is
 * the documented default rather than a refusal, because the hosted path is a working fallback.
 */
export async function capturePaymentMethodAction(payload: {
  relationshipId?: string;
  reason?: string;
  presentation?: string;
}): Promise<CaptureOutcome> {
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
      presentation: text(payload.presentation) === "embedded" ? "embedded" : "hosted",
    });
    return {
      ok: true,
      url: result.url,
      captured: result.captured,
      clientSecret: result.clientSecret,
      publishableKey: result.publishableKey,
      captureSessionId: result.captureSessionId,
    };
  } catch (error) {
    return captureFailure(error);
  }
}

/**
 * Record the method an embedded frame just saved (#748).
 *
 * The frame has no return URL to hand the session id to, so the browser hands it back here and
 * this resolves it through `resolveCapturedMethod()` — the same function, and the same
 * "the provider's objects, never the caller's claim" rule, that `/api/billing/payment/return` uses
 * for the hosted path. The relationship id is taken from the payload and compared with the session's
 * own metadata inside the write, so a session id lifted from elsewhere is refused by name.
 */
export async function resolveCaptureAction(payload: {
  relationshipId?: string;
  captureSessionId?: string;
}): Promise<CaptureOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const relationshipId = text(payload.relationshipId);
  if (relationshipId === "") return { ok: false, code: "no-such-relationship" };
  const captureSessionId = text(payload.captureSessionId);
  if (captureSessionId === "") return { ok: false, code: "invalid-request" };

  try {
    const result = await resolveCapturedMethod({
      actorUserId: user.userId,
      relationshipId,
      captureSessionId,
    });
    return {
      ok: true,
      url: result.url,
      captured: result.captured,
      clientSecret: null,
      publishableKey: null,
      captureSessionId: result.captureSessionId,
    };
  } catch (error) {
    return captureFailure(error);
  }
}

/**
 * The capture's two handled failures, one sentence each — never a 500.
 *
 * `MemberRefused` is the member's own code (`not-yours`, `no-such-relationship`); `BillingRefusal`
 * is `not-configured` when the deployment has no key for this path (the card's own requirement: a
 * missing `STRIPE_TEST_SECRET_KEY` is a sentence, not a thrown error), plus the adapter's own
 * sentences. Anything else is a real server failure and stays a throw, because swallowing it would
 * report "billing is not configured" for a database that is down.
 */
function captureFailure(error: unknown): CaptureOutcome {
  if (error instanceof MemberRefused) {
    return { ok: false, code: error.reason, message: error.message };
  }
  if (error instanceof BillingRefusal) {
    return { ok: false, code: error.code, message: error.message };
  }
  throw error;
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
