"use server";

/**
 * The initiator's relationships, as four server actions (#533 phase 2).
 *
 * `saveAspects`, `publishRelationship` and `republishInvite`. Each ends in an
 * `act()` write inside `lib/member/relationships.ts` — `relationship.aspects`, `.publish`
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
import { confirmCheckout, startCheckout } from "@/lib/billing";
import { BillingRefusal } from "@/lib/billing/port";
import { billingPlan } from "@/data/billing-plans";
import { zAlignmentSetting, zAssessmentMode } from "@/content/assessment";
import { baseUrl } from "@/lib/flow/email";
import { forkRelationshipTemplate } from "@/lib/flow/templates";
import {
  MemberCheckoutRequired,
  publishRelationship,
  republishRelationship,
  saveAspects,
  MEMBER_RELATIONSHIPS_PATH,
} from "@/lib/member/relationships";
import { editRelationship, previewRelationshipEdit } from "@/lib/member/relationship-edit";
import { MemberRefused } from "@/lib/member/publish-basis";
import type { EditDraft } from "@/lib/relationship/edit-view";
import { completeRelationship } from "@/lib/member/payment";
import type {
  AspectsOutcome,
  CompleteOutcome,
  EditOutcome,
  EditPreviewOutcome,
  ForkOutcome,
  MembershipOutcome,
  PublishOutcome,
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
 * #1010 R2 — the membership stage 5 buys, and the completion it frees
 * ------------------------------------------------------------------ */

/**
 * Buy the membership — stage 5's card step.
 *
 * **This is the only way a payment method reaches an account.** #1010 retires the per-relationship
 * capture: there is no "add a card" act anywhere, because a card exists to be charged, and the only
 * thing charged is this subscription, bought on this stage, by the Initiator, once.
 *
 * The tier is the walk's own choice (defaulting to Basic when the account is already entitled and
 * the radio group was replaced by a summary) and the interval is monthly — the membership renews
 * monthly, which is what the card says. The account is the session's, never the body's.
 *
 * The answer is the provider's client secret for the frame the walk already mounts
 * (`components/billing/stripe-frame.tsx`) — or, for the offline adapter, `completed: true` because
 * it wrote the row inside this request.
 */
export async function startMembershipAction(payload: {
  planId?: string;
  interval?: string;
}): Promise<MembershipOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const asked = text(payload.planId);
  const planId = asked === "" ? "basic" : asked;
  const interval = text(payload.interval) === "year" ? "year" : "month";
  const origin = baseUrl().replace(/\/+$/, "");

  try {
    const session = await startCheckout({
      userId: user.userId,
      planId,
      interval,
      // The frame is inside the stage, so nobody leaves the page: this is the `return_url` the
      // provider needs for the one case a frame cannot draw (an SCA challenge), and it lands the
      // payer back on their relationships rather than on a pricing page.
      successUrl: `${origin}${MEMBER_RELATIONSHIPS_PATH}`,
      cancelUrl: `${origin}${MEMBER_RELATIONSHIPS_PATH}`,
      email: user.email ?? undefined,
      presentation: "embedded",
    });
    return {
      ok: true,
      clientSecret: session.clientSecret ?? null,
      publishableKey: session.publishableKey ?? null,
      checkoutSessionId: session.id,
      completed: session.completed,
    };
  } catch (error) {
    return membershipFailure(error);
  }
}

/**
 * Confirm the membership the frame just bought — the provider's answer, not the browser's.
 *
 * The frame's `onComplete` says the form was submitted; `confirmCheckout()` asks the provider,
 * writes the `billing_subscription` row through the same idempotent path the webhook uses, and
 * answers the tier. `pending` means the provider has not finished, and the walk asks again rather
 * than claiming a membership nobody bought.
 */
export async function confirmMembershipAction(payload: {
  checkoutSessionId?: string;
}): Promise<MembershipOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const checkoutSessionId = text(payload.checkoutSessionId);
  if (checkoutSessionId === "") return { ok: false, code: "invalid-request" };

  try {
    const subscription = await confirmCheckout(user.userId, checkoutSessionId);
    if (subscription === null) {
      return {
        ok: false,
        code: "pending",
        message: "The provider has not confirmed this checkout yet. Try again in a moment.",
      };
    }
    return { ok: true, planName: billingPlan(subscription.planId)?.name };
  } catch (error) {
    return membershipFailure(error);
  }
}

/**
 * The membership's handled failures, one code each — never a 500.
 *
 * `MemberRefused` is the member's own code; `BillingRefusal` carries the adapter's sentence
 * (`not-for-sale` for a tier with no Price, `not-configured` for a deployment with no key).
 * Anything else is a real server failure and stays a throw, because swallowing it would report
 * "billing is not configured" for a database that is down.
 */
function membershipFailure(error: unknown): MembershipOutcome {
  if (error instanceof MemberRefused) {
    return { ok: false, code: error.reason, message: error.message };
  }
  if (error instanceof BillingRefusal) {
    return { ok: false, code: error.code, message: error.message };
  }
  throw error;
}

/**
 * Complete the relationship — the Initiator's one act, and it charges nothing.
 *
 * #1010 deletes the fee: the membership bought at stage 5 already covers every relationship the
 * account runs, so sealing is a state change and a Gap and no money. The ordering is the
 * library's — refuse early, then one transaction that re-reads the row under the lock — and the
 * actor is the session's account, compared with the relationship's own initiator.
 */
export async function completeRelationshipAction(payload: {
  relationshipId?: string;
  reason?: string;
}): Promise<CompleteOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const relationshipId = text(payload.relationshipId);
  if (relationshipId === "") return { ok: false, code: "no-such-relationship" };
  const reason = text(payload.reason);

  try {
    const result = await completeRelationship({
      actorUserId: user.userId,
      relationshipId,
      reason: reason === "" ? "seal the relationship and open the Gap" : reason,
    });
    return {
      ok: true,
      actionId: result.actionId,
      status: result.after.status,
      completedAt: result.after.completedAt,
    };
  } catch (error) {
    if (error instanceof MemberRefused) {
      return { ok: false, code: error.reason, message: error.message };
    }
    if (error instanceof ActRefused) return { ok: false, code: error.reason };
    throw error;
  }
}
