// template-ancestor: components/assessment-flow/my-instances.tsx   (variation: the same relationship card — a `bg-gray-50` header block carrying the template pill and the state pill, a `text-lg font-semibold` title, a body of chips, and an `h-9` action row — with the two assessment actions on every card, the paid block and the four-metric grid left out because this read does not carry a session count, and two controls that are deliberately disabled until payment and the Gap exist)

/**
 * `/dashboard/relationships` — the member's relationships as cards (#620).
 *
 * **The card is `my-instances.tsx`'s card, and the axis of variation is the data.** That card is
 * a projection of `RelationshipCard` (`lib/db/assessments.ts`): sessions, completion, mean Gap,
 * what was paid. This screen reads `MemberRelationshipRow` (`lib/member/relationships.ts`), which
 * is the *initiator's* row — the stored lifecycle, the invitation's derived view, the membership,
 * the Aspect count — and carries no opinion rows at all. So the header block, the title, the
 * chips and the `h-9` action row are the ancestor's, and the metric grid is simply absent rather
 * than drawn from figures this read never returned. `template-ancestor:` names the file for the
 * same reason every other card in `components/dashboard/` does.
 *
 * **Four actions, all four live.** The owner's decision on #620 shipped the two-row menu and the
 * card with `Activate Relationship` and `Gap Analysis` **visibly disabled**, because the payment
 * state did not exist yet and the Gap it opens was not there. That was explicitly temporary, and
 * #t_e9212bf9 is the change it named: `Activate Relationship` posts `completeRelationshipAction`
 * (which captures a method first when there is none on file), `Gap Analysis` links to the state's
 * truth — the report once the fee has landed, the assessment before that — and a refusal is a
 * sentence under the row. No control on this card is disabled to explain itself.
 *
 * **Two more refusals are drawn, not hidden.** `Publish Assessment` is a link to the relationship's
 * own screen, which is the only surface that publishes and the only one that can say why a
 * publication was refused; `Open Assessment` is a link to the session once the relationship has
 * one, and disabled — with the reason — on a draft, because there is no session for it to open.
 * A control that led to a 404 would be worse than a control that says what it is waiting for.
 *
 * **No words here.** Every label resolves from `data/pages/dashboard-relationships.ts`, which is
 * what holds this file at zero copy literals (E23); the status and invitation words are the same
 * fixtures the table drew them from.
 */
import type { PageCopy, PageCopySection } from "@/content/pages";
import { formatDate } from "@/content/core";
import { instancePath, reportPath } from "@/lib/flow/paths";
import { fillLabel, itemLabel, pageItemOf, sectionBody, sectionOf } from "@/lib/page-copy";
import { memberRelationshipPath, type MemberRelationshipRow } from "@/lib/member/relationships";
import type { CompleteOutcome } from "@/lib/member/outcomes";
import {
  PaymentControls,
  type PaymentLabels,
  type PaymentRefusals,
} from "@/components/dashboard/relationship-payment";
import { MEMBER_TEMPLATES_PATH } from "@/lib/member/templates";
import Link from "next/link";

const CARD =
  "flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900";
const CHIP =
  "inline-flex items-center rounded-full border border-gray-300 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200";
const CHIP_TEMPLATE =
  "inline-flex items-center rounded-full border border-action/45 bg-action/5 px-2.5 py-0.5 text-xs font-medium text-action";
const ACTION =
  "inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800";
const ACTION_PRIMARY =
  "inline-flex h-9 items-center justify-center rounded-md bg-action px-3 text-sm font-semibold text-action-foreground hover:bg-action-hover";
const ACTION_DISABLED =
  "inline-flex h-9 cursor-not-allowed items-center justify-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500";

/** The badge's word for a stored status, from the fixture's `status` section. */
function statusLabel(status: PageCopySection, value: string): string {
  const known = (status.items ?? []).find((item) => item.id === value);
  return known?.label ?? value;
}

/** The badge's word for the invitation's derived state. */
function viewLabel(view: PageCopySection, value: string): string {
  const known = (view.items ?? []).find((item) => item.id === value);
  return known?.label ?? value;
}

export function RelationshipCards({
  copy,
  rows,
  unreadable,
  onCapture,
  onComplete,
}: {
  copy: PageCopy;
  rows: readonly MemberRelationshipRow[];
  unreadable: string | null;
  /** #t_e9212bf9 — the two payment writes the card's `Activate Relationship` posts. */
  onCapture: (payload: {
    relationshipId?: string;
    reason?: string;
  }) => Promise<{ ok: true; url: string | null } | { ok: false; code: string; message?: string }>;
  onComplete: (payload: {
    relationshipId?: string;
    planId?: string;
    reason?: string;
  }) => Promise<CompleteOutcome>;
}) {
  const list = sectionOf(copy, "list");
  const statusCopy = sectionOf(copy, "status");
  const viewCopy = sectionOf(copy, "view");
  const card = sectionOf(copy, "card");
  const empty = sectionOf(copy, "empty");
  const unreadableCopy = sectionOf(copy, "unreadable");
  const paymentCopy = sectionOf(copy, "payment");
  const paymentRefusalCopy = sectionOf(copy, "payment-refusals");
  const noneLabel = pageItemOf(copy, "none").label;
  const paymentLabels: PaymentLabels = {
    heading: paymentCopy.heading ?? "",
    body: sectionBody(paymentCopy),
    method: itemLabel(paymentCopy, "method"),
    methodNone: itemLabel(paymentCopy, "method-none"),
    methodOnFile: itemLabel(paymentCopy, "method-on-file"),
    fee: itemLabel(paymentCopy, "fee"),
    nothingToday: itemLabel(paymentCopy, "nothing-today"),
    due: itemLabel(paymentCopy, "due"),
    charged: itemLabel(paymentCopy, "charged"),
    retrying: itemLabel(paymentCopy, "retrying"),
    expired: itemLabel(paymentCopy, "expired"),
    capture: itemLabel(paymentCopy, "capture"),
    capturing: itemLabel(paymentCopy, "capturing"),
    activate: itemLabel(paymentCopy, "activate"),
    activating: itemLabel(paymentCopy, "activating"),
    gap: itemLabel(paymentCopy, "gap"),
    capturedNotice: itemLabel(paymentCopy, "captured-notice"),
    failedNotice: itemLabel(paymentCopy, "failed-notice"),
  };
  const paymentRefusals: PaymentRefusals = Object.fromEntries(
    (paymentRefusalCopy.items ?? []).map((item) => [item.id, item.label]),
  );

  if (unreadable !== null) {
    return (
      <div
        data-relationships-unreadable
        className="rounded-lg border border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950"
      >
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {unreadableCopy.heading}
        </p>
        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{unreadable}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{list.heading}</h2>
        <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-300">{sectionBody(list)}</p>
      </div>

      {rows.length === 0 ? (
        <div
          data-relationships-empty
          className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900"
        >
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{empty.heading}</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{sectionBody(empty)}</p>
          <p className="mt-3 text-sm">
            <Link className="underline underline-offset-4" href={MEMBER_TEMPLATES_PATH}>
              {pageItemOf(copy, "new-template").label}
            </Link>
          </p>
        </div>
      ) : (
        <ul data-relationships-cards className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const assessmentHref =
              row.sessionRecordId === null ? null : instancePath(row.sessionRecordId);
            const publishHref = memberRelationshipPath(row.id);
            /**
             * #t_e9212bf9 — `Gap Analysis`'s destination is the state's truth: the report once the
             * fee has landed and the Gap is open, the assessment itself before that (where the
             * stage says what is still missing), and the relationship when there is no session to
             * point at. A single fixed href would 404 on two of the three.
             */
            const gapHref =
              row.sessionRecordId === null
                ? publishHref
                : row.status === "complete"
                  ? reportPath(row.sessionRecordId)
                  : instancePath(row.sessionRecordId);
            const other = row.counterpartyName ?? itemLabel(card, "not-claimed");
            return (
              <li
                key={row.id}
                data-relationship-card={row.id}
                data-relationship-status={row.status}
                data-relationship-view={row.view}
                className={CARD}
              >
                <div className="flex flex-col gap-2 border-b border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={CHIP_TEMPLATE}>{itemLabel(card, "template")}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={CHIP}>{statusLabel(statusCopy, row.status)}</span>
                      {row.membership.state === "lapsed" ? (
                        <span data-membership-state="lapsed" className={CHIP}>
                          {statusLabel(statusCopy, "read-only")}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <Link
                    href={publishHref}
                    className="line-clamp-2 text-lg font-semibold text-gray-900 hover:text-action hover:underline dark:text-gray-100"
                  >
                    {row.title}
                  </Link>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {itemLabel(card, "with")} · {other}
                  </p>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={CHIP}>
                      {fillLabel(itemLabel(card, "aspects"), { count: String(row.aspectCount) })}
                    </span>
                    <span data-invite-view={row.view} className={CHIP}>
                      {viewLabel(viewCopy, row.view)}
                    </span>
                  </div>
                  <p className="mt-auto text-xs text-gray-500 dark:text-gray-400">
                    {fillLabel(itemLabel(card, "last-session"), {
                      when: formatDate(row.createdAt),
                    })}
                  </p>
                </div>

                <div className="mt-auto flex flex-col gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
                  <div className="flex flex-wrap gap-2">
                    {assessmentHref === null ? (
                      <button
                        type="button"
                        disabled
                        title={itemLabel(card, "open-assessment")}
                        className={ACTION_DISABLED}
                      >
                        {itemLabel(card, "open-assessment")}
                      </button>
                    ) : (
                      <Link href={assessmentHref} className={ACTION}>
                        {itemLabel(card, "open-assessment")}
                      </Link>
                    )}
                    <Link href={publishHref} className={ACTION_PRIMARY}>
                      {itemLabel(card, "publish-assessment")}
                    </Link>
                    {/* #t_e9212bf9 — the two controls #620 shipped disabled. Neither is disabled
                        now: `Activate Relationship` posts the completion (or opens the capture when
                        no method is on file), `Gap Analysis` links to the state's truth, and a
                        refusal is a sentence under the row rather than a control that explains
                        nothing. Drawn once the relationship has a session: a draft has nothing to
                        activate and no Gap to open, and `Publish Assessment` is its next step. */}
                    {row.sessionRecordId === null ? null : (
                      <PaymentControls
                        labels={paymentLabels}
                        refusals={paymentRefusals}
                        payment={row.payment}
                        gapHref={gapHref}
                        none={noneLabel}
                        relationshipId={row.id}
                        onCapture={onCapture}
                        onComplete={onComplete}
                      />
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {itemLabel(card, "disabled-note")}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
