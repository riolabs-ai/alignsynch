"use client";

// template-ancestor: components/assessment-flow/create-relationship.tsx   (variation: the last stage is one decision in two columns — a three-step payment walk on the left and the send it unlocks on the right — so the gate and the act are drawn together)

/**
 * `StageInvite` — stage 5, **Invite** (#825), with the send gated by the walk (#911).
 *
 * **Why this is a client component.** The send is one control whose state is another control's
 * outcome: the walk saves a card, and the foot's `send email to counterparty now` enables. That fact
 * has to live somewhere both columns can read, and the alternative — a server-rendered column with a
 * client panel inside it — could only be gated by a second request. So the stage owns the state and
 * the two columns read it.
 *
 * **The gate is real, and it is enforced twice.** Here, the control is `disabled` until the card is
 * on file; on the server, `sendDraftInvitation()` refuses a relationship with no captured method.
 * The UI half is the courtesy — a person should never be offered an act that will be refused — and
 * the server half is the rule. A crafted POST cannot publish an unpaid draft.
 *
 * **Both states are drawn, and the locked one explains itself.** `data-send-gate` is the state, the
 * aside carries the sentence that says what unlocks the send, and the send control points at that
 * sentence with `aria-describedby` — a greyed control with no reason beside it is where people close
 * the tab (the owner's bar on this card).
 *
 * **Save the draft is always the other choice.** The link sits inside the send card at every state,
 * needs no plan and no card, charges nothing, and lands on the dashboard where the draft waits —
 * which is why the locked state is not a dead end.
 *
 * Every reader-visible word is `data/pages/assessment-create.ts` (`invite`) — E23 counts what a
 * component writes, and this one writes none.
 */
import { useId, useState } from "react";
import type { PageCopy } from "@/content/pages";
import type { CreateDraft } from "@/lib/flow/create-draft";
import { RELATIONSHIPS_PATH, sendInvitationPath } from "@/lib/flow/paths";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { type CheckoutHandlers, InviteWalk } from "./invite-walk";
import { StageFoot } from "./stage-foot";

const CARD =
  "space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900";
/** The send card, once the walk clears: the artifact's action border (`sendCard` in v9). */
const CARD_ACTIVE = "space-y-3 rounded-lg border border-action bg-action/5 p-4 dark:bg-gray-900";
/** The same card, before the walk clears: nothing on it is pressable except the draft. */
const CARD_LOCKED =
  "space-y-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/60";
const HEADING = "text-lg font-semibold text-gray-900 dark:text-gray-100";
const HEADING_LOCKED = "text-lg font-semibold text-gray-500 dark:text-gray-400";
const SMALL = "text-xs text-gray-600 dark:text-gray-300";
const SECONDARY =
  "inline-flex h-11 w-full items-center justify-center rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800";

export function StageInvite({
  copy,
  draft,
  instanceRecordId,
  relationshipId,
  initialPaid,
  planIncluded,
  checkout,
  backHref,
  cancelHref,
  cancelLabel,
  advanceClasses,
  sendFormId,
}: {
  copy: PageCopy;
  draft: CreateDraft;
  /** The relationship stage 4 wrote — the send posts to its own address. */
  instanceRecordId: string;
  /**
   * The same relationship's own row id — what the payment walk is allowed to name.
   *
   * The send addresses the **record** (`?instance=`), the capture addresses the **relationship**,
   * and handing the capture the record id is a refusal the person reads as a broken card form: the
   * membership acts answer "no relationship holds the id". Two ids, two jobs.
   */
  relationshipId: string;
  /**
   * The card is already on file (`paymentArmed` on the screen read). A person who paid and came back
   * lands on the thank-you with the send enabled, instead of being asked to pay twice.
   */
  initialPaid?: boolean;
  /** What the account's plan already covers (#870) — the walk's plan panel reads it. */
  planIncluded?: { readonly name: string; readonly entitled: boolean };
  /** The server's capture actions. Absent in a render-only test. */
  checkout?: CheckoutHandlers;
  backHref: string;
  cancelHref: string;
  cancelLabel: string;
  advanceClasses: string;
  /** The send form's id — the foot's advance submits it from outside the form. */
  sendFormId: string;
}) {
  const invite = sectionOf(copy, "invite");
  const draftFact = sectionOf(copy, "review");

  const [paid, setPaid] = useState(initialPaid === true);
  /** The id the send control points its accessible description at, so the reason is announced. */
  const unlockId = useId();

  return (
    <>
      {/* One column at 390, in the order the decision needs: plan, card, thank you, then the send. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <InviteWalk
          copy={copy}
          relationshipId={relationshipId}
          paid={paid}
          onPaid={() => setPaid(true)}
          {...(checkout === undefined ? {} : { checkout })}
          {...(planIncluded === undefined ? {} : { planIncluded })}
        />

        <aside className="space-y-5" data-send-gate={paid ? "open" : "locked"}>
          <form
            id={sendFormId}
            action={sendInvitationPath(instanceRecordId)}
            method="post"
            aria-labelledby="create-invite-heading"
            data-create-send="true"
            className={paid ? CARD_ACTIVE : CARD_LOCKED}
          >
            <h2 id="create-invite-heading" className={paid ? HEADING : HEADING_LOCKED}>
              {itemLabel(invite, "cta-heading")}
            </h2>
            <p className={SMALL}>{itemLabel(invite, "cta-body")}</p>

            {/*
              The sentence that explains the control. It is in the same card as the draft link and
              immediately above the foot, and the send button names it with `aria-describedby` — so
              the reason travels with the control for a screen reader too.
            */}
            <p
              id={unlockId}
              data-send-explain={paid ? "open" : "locked"}
              role="status"
              className={`text-sm ${paid ? "text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-300"}`}
            >
              {paid ? itemLabel(invite, "active") : itemLabel(invite, "locked")}
            </p>

            {/* Save the draft, always: no plan, no card, nothing charged, the row stays `draft`. */}
            <a href={RELATIONSHIPS_PATH} className={SECONDARY} data-create-keep-draft="true">
              {itemLabel(invite, "draft")}
            </a>
          </form>

          {/* The two sentences that make "keep it as a draft" safe to choose. */}
          <section aria-labelledby="create-invite-note-heading" className={CARD}>
            <h2 id="create-invite-note-heading" className={HEADING}>
              {itemLabel(invite, "note-heading")}
            </h2>
            <p className={SMALL}>{itemLabel(invite, "reassure")}</p>
            <p className={SMALL}>{itemLabel(invite, "draft-help")}</p>
            <p className={SMALL}>
              {itemLabel(invite, "sent-to")} {draft.email.trim() || itemLabel(draftFact, "none")}
            </p>
          </section>
        </aside>
      </div>

      <StageFoot
        backHref={backHref}
        backLabel={itemLabel(invite, "back")}
        cancelHref={cancelHref}
        cancelLabel={cancelLabel}
        advance={
          <button
            type="submit"
            form={sendFormId}
            className={`${advanceClasses} disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 disabled:hover:bg-gray-200 dark:disabled:bg-gray-800 dark:disabled:text-gray-500`}
            disabled={!paid}
            aria-describedby={unlockId}
            data-send-confirm={paid ? "enabled" : "disabled"}
          >
            {itemLabel(invite, "submit")}
          </button>
        }
      />
    </>
  );
}
