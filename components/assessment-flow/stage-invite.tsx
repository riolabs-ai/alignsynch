"use client";

// template-ancestor: components/assessment-flow/create-relationship.tsx   (variation: the last stage is one column of one act — a four-step walk whose last step is the send — instead of a payment walk gated against a send card beside it)

/**
 * `StageInvite` — stage 5, **Invite** (#825), with the act at the end of the walk (#1014).
 *
 * **Why this is a client component.** It owns the one fact two surfaces read: the membership is
 * live, which is what opens the act. That fact has to live somewhere the walk can see, and the
 * alternative — a server-rendered column with a client panel beside it — could only be gated by a
 * second request.
 *
 * **The act is inside the walk (#1014).** This stage used to draw the send in the right column and a
 * `Continue as Draft` link under it, while the walk's thank-you carried a sentence telling the
 * reader that the control was *beside* the walk. The card put both controls in the walk's last step
 * and removed that sentence: one act, one control, on the surface that earned it. What is left in
 * the column is what the column was for — the two sentences that make keeping a draft safe to
 * choose — because a draft is a decision and it deserves its own paragraph rather than a button's
 * worth of space.
 *
 * **The gate is real, and it is enforced twice.** In the walk, the act is one step past the
 * thank-you and the thank-you is only reachable once the membership is live, so an unpaid walk has
 * no send control to press at all. On the server, `sendDraftInvitation()` refuses a relationship
 * whose Initiator holds no live membership (`no-payment-method`). The first half is the courtesy — a
 * person should never be offered an act that will be refused — and the second is the rule: a crafted
 * POST cannot publish an unpaid draft.
 *
 * **The foot carries no advance.** Stages 1–4 advance from the foot; stage 5's advance *is* the
 * walk's last step, which is the whole of #1014. `Back` and `Cancel` stay where the foot's shape
 * puts them.
 *
 * Every reader-visible word is `data/pages/assessment-create.ts` (`invite`, `review`) — E23 counts
 * what a component writes, and this one writes none.
 */
import { useState } from "react";
import Link from "next/link";
import type { PageCopy } from "@/content/pages";
import { billingPlan } from "@/data/billing-plans";
import type { CreateDraft } from "@/lib/flow/create-draft";
import type { CarriedPlan } from "@/lib/flow/plan-intent";
import { PRICING_PATH } from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { type CheckoutHandlers, InviteWalk } from "./invite-walk";
import { StageFoot } from "./stage-foot";

const CARD =
  "space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900";
const HEADING = "text-lg font-semibold text-gray-900 dark:text-gray-100";
const SMALL = "text-xs text-gray-600 dark:text-gray-300";

export function StageInvite({
  copy,
  draft,
  instanceRecordId,
  relationshipId,
  initialPaid,
  planIncluded,
  carriedPlan,
  checkout,
  trialEndsAt,
  backHref,
  cancelHref,
  cancelLabel,
}: {
  copy: PageCopy;
  draft: CreateDraft;
  /** The session stage 4 wrote the relationship from — the send posts to its own address. */
  instanceRecordId: string;
  /**
   * The relationship's own row id — what the membership addresses, and where the walk lands.
   *
   * The send addresses the **session** (`?instance=`), the membership addresses the
   * **relationship**, and handing the membership the session's record id is a refusal the person
   * reads as a broken card form: the membership acts answer "no relationship holds the id". Two
   * ids, two jobs — and both end the walk on the relationship's own screen.
   */
  relationshipId: string;
  /**
   * The membership is already live — the returning state. A person who paid and came back lands on
   * the thank-you with the act one press away, instead of being asked to pay twice.
   */
  initialPaid?: boolean;
  /** What the account's plan already covers (#870) — the walk's plan panel reads it. */
  planIncluded?: { readonly name: string; readonly entitled: boolean };
  /**
   * The plan chosen on `/pricing`, measured by the page from the carried cookie (#1043). The walk
   * opens with that row selected; absent means nothing was carried and the panel is the choice.
   */
  carriedPlan?: CarriedPlan;
  /** The server's membership actions. Absent in a render-only test. */
  checkout?: CheckoutHandlers;
  /**
   * **The trial's end, as the page measured it** (#1115).
   *
   * The instant `trialStateOf()` read for the creating account, handed through untouched so the
   * walk can print it as a date. Its presence is what makes the walk the card-free create panel:
   * the create path supplies no `checkout`, so no stage of this flow can reach the adapter.
   */
  trialEndsAt?: string;
  backHref: string;
  cancelHref: string;
  cancelLabel: string;
}) {
  const invite = sectionOf(copy, "invite");
  const draftFact = sectionOf(copy, "review");

  const [paid, setPaid] = useState(initialPaid === true);

  return (
    <>
      {/* One column at 390, in the order the decision needs: the plan, the card, the thank-you, the
          act — then the two sentences that make the draft a real choice. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <InviteWalk
          copy={copy}
          instanceRecordId={instanceRecordId}
          relationshipId={relationshipId}
          paid={paid}
          onPaid={() => setPaid(true)}
          {...(checkout === undefined ? {} : { checkout })}
          {...(planIncluded === undefined ? {} : { planIncluded })}
          {...(carriedPlan === undefined ? {} : { carriedPlan })}
          {...(trialEndsAt === undefined ? {} : { trialEndsAt })}
        />

        {/* The two sentences that make "keep it as a draft" safe to choose. */}
        <aside className="space-y-5">
          {/*
            #1127 — **the plan the reader chose on `/pricing`, stated once on the stage that sells.**
            The v2 bundle draws this as a chip beside the invite action: the tier's own name from
            `data/billing-plans.ts`, the one sentence that says when it starts and what it costs
            (nothing, until a card is added), and a way back to change the choice. Drawn only when
            a plan was actually carried — a stage that printed "no plan" would be a question the
            visitor already answered.
          */}
          {carriedPlan === undefined ? null : (
            <section
              aria-labelledby="create-invite-plan-heading"
              className={CARD}
              data-plan-chip={carriedPlan.planId}
            >
              <h2 id="create-invite-plan-heading" className={SMALL}>
                {fillLabel(itemLabel(invite, "plan-chip"), {
                  plan: billingPlan(carriedPlan.planId)?.name ?? carriedPlan.planId,
                })}
              </h2>
              <Link
                className="text-xs font-semibold text-action underline underline-offset-4"
                href={PRICING_PATH}
              >
                {itemLabel(invite, "plan-change")}
              </Link>
            </section>
          )}
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
      />
    </>
  );
}
