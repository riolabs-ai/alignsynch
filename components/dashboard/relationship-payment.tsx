"use client";

// template-ancestor: components/dashboard/relationship-detail.tsx   (variation: the payment band and the two card controls — the same `Card` band, `h-9` action row and refusal line, with the method / fee / date facts where the detail's Aspect editor sits, and a control that posts a member action instead of a draft)

/**
 * The payment door — the screen half (#t_e9212bf9).
 *
 * #619 shipped `capturePaymentMethodAction` and `completeRelationshipAction` and **nothing called
 * them**: `git grep` over `components/` answered zero, and the card still rendered two
 * `<button disabled>`. This module is the caller, and it is the only one.
 *
 * **It decides nothing.** `payment` is the door the read computed
 * (`lib/member/payment-door.ts::paymentDoorOf`) — phase, fee, the stored `charge_due_at`, and
 * whether the facts allow a completion. The action re-decides all of it from the row under its own
 * lock, so a stale screen produces a refusal sentence rather than a charge nobody expected.
 *
 * **Two redirects, and they are not the same shape.** `capturePaymentMethodAction` answers
 * `{ ok: true, url }` — the hosted capture page, or `null` when the adapter captured inline (the
 * keyless mock). `completeRelationshipAction` answers `{ ok: false, code:
 * "payment-method-required", url }` when the browser has to capture first, which is a **place to
 * go**, not a failure: the payer is sent there and nothing was charged. Both are `location.assign`,
 * because the provider's page is a document and a client-side push would keep this screen mounted
 * underneath it.
 *
 * **Neither control is ever `disabled`.** #620 shipped them disabled because the payment state did
 * not exist; this is the change that makes it exist. A refusal is a sentence under the row — and
 * the sentence a disabled button could never say is the whole point of the card.
 *
 * **No words here.** Every sentence is a prop the server surface resolved from its own
 * `data/pages/*` fixture: this file is reached by both `/dashboard/relationships` and
 * `/dashboard/relationships/[id]`, and E23 attributes a component to each route that reaches it —
 * so a literal here would have to live in two fixtures at once. `refusals` is keyed by the **pure**
 * word (`PAYMENT_REFUSALS`), never by the action's code: `paymentRefusalOf()` is that translation,
 * and it lives in one function so two screens cannot disagree about which sentence a code gets.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { formatCurrency, formatDate } from "@/content/core";
import type { CompleteOutcome } from "@/lib/member/outcomes";
import { type PaymentDoor, paymentRefusalOf } from "@/lib/member/payment-door";

/** Everything the band says, already resolved. */
export interface PaymentLabels {
  readonly heading: string;
  readonly body: string;
  readonly method: string;
  readonly methodNone: string;
  readonly methodOnFile: string;
  readonly fee: string;
  readonly nothingToday: string;
  readonly due: string;
  readonly charged: string;
  readonly retrying: string;
  readonly expired: string;
  readonly capture: string;
  readonly capturing: string;
  readonly activate: string;
  readonly activating: string;
  readonly gap: string;
  readonly capturedNotice: string;
  readonly failedNotice: string;
}

/** The refusal sentences, keyed by the pure word. */
export type PaymentRefusals = Readonly<Record<string, string>>;

const CARD = "rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900";
const ACTION =
  "inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800";
const ACTION_PRIMARY =
  "inline-flex h-9 items-center justify-center rounded-md bg-action px-3 text-sm font-semibold text-action-foreground hover:bg-action-hover";

/** `{amount}` and `{date}` into a sentence the fixture owns. */
function fill(label: string, values: Readonly<Record<string, string>>): string {
  return label.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}

/** The money, through the one currency formatter the repo has (`content/core.ts`). */
function money(cents: number): string {
  return formatCurrency(Number.isFinite(cents) && cents > 0 ? Math.round(cents) : 0);
}

/** An instant for a sentence, or the board's own mark for "no instant". */
function date(iso: string | null, none: string): string {
  return iso === null ? none : formatDate(iso);
}

/**
 * The sentence under the row. Four facts and no clock: the phase the read derived, and the two
 * instants the row stores. `chargeDueAt` is `charge_due_at`, never `now + 7 days`.
 */
function statusSentence(payment: PaymentDoor, labels: PaymentLabels, none: string): string {
  const amount = money(payment.amountCents);
  if (payment.phase === "charged") {
    return fill(labels.charged, { amount, date: date(payment.chargedAt, none) });
  }
  if (payment.phase === "expired") {
    return fill(labels.expired, { date: date(payment.paymentDeadlineAt, none) });
  }
  if (payment.phase === "retrying") {
    return fill(labels.retrying, { amount });
  }
  if (payment.chargeDueAt === null) {
    return fill(labels.nothingToday, { amount });
  }
  return fill(labels.due, { amount, date: date(payment.chargeDueAt, none) });
}

/** The sentence for a refusal: the pure word's fixture line, else the server's own sentence. */
function refusalSentenceOf(
  code: string,
  message: string | undefined,
  refusals: PaymentRefusals,
): string {
  const word = paymentRefusalOf(code);
  if (word !== null) {
    const known = refusals[word];
    if (known !== undefined) return known;
  }
  if (message !== undefined && message.trim() !== "") return message;
  return refusals[code] ?? code;
}

/** What both surfaces need from the two actions, and nothing else. */
interface DoorHandlers {
  readonly relationshipId: string;
  readonly onCapture: (payload: {
    relationshipId?: string;
  }) => Promise<{ ok: true; url: string | null } | { ok: false; code: string; message?: string }>;
  readonly onComplete: (payload: { relationshipId?: string }) => Promise<CompleteOutcome>;
}

/**
 * The two writes, and the three answers that are not a refusal to print.
 *
 * One `useTransition` for both, because they act on the same row and two in-flight writes to it is
 * the one state the server would have to arbitrate. `pending` gates the handlers rather than the
 * controls: a disabled attribute on these two is what the card exists to remove.
 */
function useDoor({ relationshipId, onCapture, onComplete }: DoorHandlers) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refusal, setRefusal] = useState<{ code: string; message?: string } | null>(null);
  const [captured, setCaptured] = useState(false);

  function fail(code: string, message: string | undefined): void {
    setRefusal({ code, ...(message === undefined ? {} : { message }) });
  }

  function go(url: string): void {
    // The provider's page is a document; a client-side push would keep this screen mounted.
    window.location.assign(url);
  }

  function capture(): void {
    if (pending) return;
    setRefusal(null);
    setCaptured(false);
    startTransition(async () => {
      const answer = await onCapture({ relationshipId });
      if (!answer.ok) {
        fail(answer.code, answer.message);
        return;
      }
      if (answer.url !== null) {
        go(answer.url);
        return;
      }
      // Captured inline: re-read the row so the band prints the instant the server stored, not one
      // this component guessed.
      setCaptured(true);
      router.refresh();
    });
  }

  function complete(): void {
    if (pending) return;
    setRefusal(null);
    startTransition(async () => {
      const answer = await onComplete({ relationshipId });
      if (!answer.ok) {
        // `payment-method-required` carries a url and is a place to go, not a sentence.
        if (answer.url !== undefined && answer.url !== "") {
          go(answer.url);
          return;
        }
        fail(answer.code, answer.message);
        return;
      }
      router.refresh();
    });
  }

  return { pending, refusal, captured, capture, complete };
}

/**
 * The card's action row: `Activate Relationship` posts the completion, `Gap Analysis` is a link
 * whose target is the state's truth — the report once the Gap is open, the relationship otherwise.
 *
 * When no method is on file yet, `Activate` opens the capture instead of posting a completion that
 * would only answer "capture first": one click, and the same sentence if the server disagrees.
 */
export function PaymentControls({
  labels,
  refusals,
  payment,
  gapHref,
  relationshipId,
  none,
  onCapture,
  onComplete,
}: DoorHandlers & {
  readonly labels: PaymentLabels;
  readonly refusals: PaymentRefusals;
  /** The door, or `null` for a relationship created before the obligation existed (`0036`). */
  readonly payment: PaymentDoor | null;
  readonly gapHref: string;
  /** The fixture's own word for "no instant" — `—`. */
  readonly none: string;
}) {
  const { refusal, capture, complete } = useDoor({
    relationshipId,
    onCapture,
    onComplete,
  });
  const paid = payment?.phase === "charged";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {paid ? null : (
          <button
            type="button"
            onClick={payment?.canComplete === true ? complete : capture}
            className={ACTION}
          >
            {payment?.canComplete === true ? labels.activate : labels.capture}
          </button>
        )}
        <Link href={gapHref} className={paid ? ACTION_PRIMARY : ACTION}>
          {labels.gap}
        </Link>
      </div>
      {refusal === null ? null : (
        <p data-payment-refusal={refusal.code} className="text-xs text-gray-700 dark:text-gray-300">
          {refusalSentenceOf(refusal.code, refusal.message, refusals)}
        </p>
      )}
      {payment === null ? null : (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {statusSentence(payment, labels, none)}
        </p>
      )}
    </>
  );
}

/**
 * The detail screen's Payment band: the method, the fee, the instant the fee is taken and the
 * refusal line — plus the return state (`?payment=captured|failed`) the provider's redirect lands
 * with, which is a fact about this visit rather than a column.
 *
 * Drawn only for the relationship's payer. The read hands every other viewer `payment: null`, so
 * the band cannot render for a counterparty even if a page forgot to check (ADR-8).
 */
export function PaymentBand({
  labels,
  refusals,
  payment,
  gapHref,
  relationshipId,
  returnState,
  none,
  onCapture,
  onComplete,
}: DoorHandlers & {
  readonly labels: PaymentLabels;
  readonly refusals: PaymentRefusals;
  readonly payment: PaymentDoor;
  readonly gapHref: string;
  /** The fixture's own word for "no instant" — `—`. */
  readonly none: string;
  /** `?payment=captured` / `?payment=failed` — the return route's own answer. */
  readonly returnState?: "captured" | "failed";
}) {
  const { pending, refusal, captured, capture, complete } = useDoor({
    relationshipId,
    onCapture,
    onComplete,
  });
  const amount = money(payment.amountCents);
  const paid = payment.phase === "charged";
  const hasMethod = payment.chargeDueAt !== null || paid;
  const returned = captured || returnState === "captured" ? "captured" : returnState;
  const notice =
    returned === "captured"
      ? labels.capturedNotice
      : returned === "failed"
        ? labels.failedNotice
        : null;

  return (
    <section data-payment-band={payment.phase} className={CARD}>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{labels.heading}</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{labels.body}</p>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="text-gray-500 dark:text-gray-400">{labels.method}</dt>
          <dd data-payment-method={hasMethod ? "on-file" : "none"}>
            {hasMethod ? labels.methodOnFile : labels.methodNone}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-gray-500 dark:text-gray-400">{labels.fee}</dt>
          <dd>{amount}</dd>
        </div>
        <div className="sm:col-span-2">
          <dd>{statusSentence(payment, labels, none)}</dd>
        </div>
      </dl>

      {notice === null ? null : (
        <p
          data-payment-return={returned}
          className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
          {notice}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {paid ? null : (
          <>
            <button type="button" onClick={capture} aria-busy={pending} className={ACTION}>
              {pending ? labels.capturing : labels.capture}
            </button>
            <button type="button" onClick={complete} aria-busy={pending} className={ACTION_PRIMARY}>
              {pending ? labels.activating : labels.activate}
            </button>
          </>
        )}
        <Link href={gapHref} className={ACTION}>
          {labels.gap}
        </Link>
      </div>

      {refusal === null ? null : (
        <p
          data-payment-refusal={refusal.code}
          className="mt-3 text-sm text-gray-800 dark:text-gray-200"
        >
          {refusalSentenceOf(refusal.code, refusal.message, refusals)}
        </p>
      )}
    </section>
  );
}
