/**
 * template-ancestor: components/assessment-flow/instance-view.tsx   (variation: server-rendered from the instance's own rows, and the acceptance is real — each seat reads its own `party.accepted_at`, the control posts to the accept endpoint, and the Aspect columns show the viewer's own answers with the other seat sealed until both accept)
 *
 * `AcceptSession` — the acceptance step, live since R2 (#427).
 *
 * The page is read in the order a decision is made, the same order the v1 prototype settled on:
 *
 *   1. **What is being accepted** — Type, Mode and Setting, marked rather than captioned.
 *   2. **The decision** — the two seats side by side, each with the facts this build actually
 *      holds (how many Aspects it answered, whether and when it accepted), then the control that
 *      records *this* party's acceptance.
 *   3. **The Aspect detail** — beneath the decision, never before it, with the viewer's own
 *      answers shown and the other seat sealed.
 *
 * **What changed from the in-progress screen (#409).** There is an acceptance to draw now:
 * `party.accepted_at` (`0016_party_acceptance.sql`) is a row, and `readFlowScreen()` hands the page
 * one `FlowSeat` per party. So each seat says "Accepted · <date>" or "Not accepted yet" — a fact
 * read from a row, not a badge invented for the layout — and the control is a real `POST` to
 * `/assessment/instances/[instanceId]/accept`.
 *
 * **The control is honest about every state it can be in**, and there are five: not a party
 * (`coach-note`), the viewer's own sheet unfinished (`answer-first`, with the link to it), the
 * viewer's own acceptance recorded (`you-accepted`), both accepted (`both-accepted` + the report),
 * and the one state that gets a button (own sheet complete, own acceptance missing).
 *
 * **The blind rule is drawn, not described.** The Aspect detail renders the **viewer's** answers
 * from `aspects[].own` — the only opinions `visibleRoles()` let through the read path — and the
 * other seat's column is a sealed chip carrying the person's name and no value. After the second
 * acceptance the status is `complete`, this page says so, and the report is where both columns
 * live: the report page is one click away and is the only surface that composes the two sheets.
 *
 * Literal-free: every word is `data/pages/assessment-accept.ts` (E23) except the model's own
 * glossary — `MODE_LABELS`, `SETTING_LABELS`, `SETTING_DEFINITIONS`, `OPINION_LABELS` — and the
 * instants, which are `formatDate()` over the ISO value the row carried.
 */
import { Lock } from "lucide-react";
import Link from "next/link";
import {
  MODE_LABELS,
  OPINION_LABELS,
  SETTING_DEFINITIONS,
  SETTING_LABELS,
  opinionKindsFor,
  type AlignmentSetting,
  type AssessmentMode,
  type Opinions,
  type PartyRole,
} from "@/content/assessment";
import { formatDate } from "@/content/core";
import type { PageCopy } from "@/content/pages";
import type { InstanceStatus } from "@/lib/flow/state";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { StageColumn } from "./stage-column";

/** Why the last acceptance attempt was refused — the `?accept=` codes the route redirects with. */
export const ACCEPT_PROBLEM_CODES = [
  "already-accepted",
  "incomplete",
  "not-a-party",
  "no-such-instance",
] as const;

export type AcceptProblemCode = (typeof ACCEPT_PROBLEM_CODES)[number];

/** A query value as a code, or `undefined` — anything else is ignored rather than rendered. */
export function acceptProblemOf(value: string | undefined): AcceptProblemCode | undefined {
  return ACCEPT_PROBLEM_CODES.find((code) => code === value);
}

/** One Aspect as the detail band draws it: the words, the band's ends, and the viewer's answer. */
export interface AcceptAspect {
  readonly itemId: string;
  readonly prompt: string;
  readonly leftValue: string;
  readonly rightValue: string;
  /** The viewer's own scores, or `null` while this Aspect is unanswered by them. */
  readonly own: Opinions | null;
}

/** One seat: the party row's own name, its answered count, and its acceptance instant. */
export interface AcceptSeat {
  readonly role: PartyRole;
  readonly name: string;
  /** `opinion` rows for this role — one per Aspect the party has answered, never a score. */
  readonly answered: number;
  /** `party.accepted_at` as an ISO instant, or `null` for "not yet". */
  readonly acceptedAt: string | null;
}

/** The seat header: the role word and the person's own name, as the row holds them. */
function SeatHeading({ wording, name }: { wording: string; name: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {wording}
      </p>
      <p className="mt-0.5 truncate text-base font-semibold text-gray-900 dark:text-gray-100">
        {name}
      </p>
    </div>
  );
}

export function AcceptSession({
  copy,
  seats,
  aspects,
  mode,
  setting,
  templateTitle,
  viewerRole,
  viewerAnswered,
  viewerAccepted,
  status,
  problem,
  acceptAction,
  answerHref,
  reportHref,
  backHref,
}: {
  copy: PageCopy;
  seats: readonly AcceptSeat[];
  aspects: readonly AcceptAspect[];
  mode: AssessmentMode;
  setting: AlignmentSetting;
  templateTitle: string;
  viewerRole: PartyRole | "coach";
  viewerAnswered: number;
  viewerAccepted: boolean;
  status: InstanceStatus;
  problem: AcceptProblemCode | undefined;
  acceptAction: string;
  answerHref: string;
  reportHref: string;
  backHref: string;
}) {
  const steps = sectionOf(copy, "steps");
  const acceptance = sectionOf(copy, "acceptance");
  const detail = sectionOf(copy, "aspects");
  const kinds = opinionKindsFor(mode);

  const seatWording = (role: PartyRole) =>
    role === "initiator"
      ? itemLabel(acceptance, "seat-initiator")
      : itemLabel(acceptance, "seat-counterparty");

  const other = seats.find((seat) => seat.role !== viewerRole);
  const complete = status === "complete";
  const ownComplete = aspects.length > 0 && viewerAnswered >= aspects.length;

  return (
    <StageColumn>
      <div className="space-y-6">
        <p>
          <Link href={backHref} className="text-sm font-medium text-action hover:underline">
            {itemLabel(acceptance, "back")}
          </Link>
        </p>

        {/* A refusal the POST came back with: the code's own sentence, never a bare number. */}
        {problem === undefined ? null : (
          <section
            aria-labelledby="accept-problem-heading"
            className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950"
          >
            <h2
              id="accept-problem-heading"
              className="text-sm font-semibold text-red-900 dark:text-red-200"
            >
              {sectionOf(copy, "problems").heading}
            </h2>
            <p className="mt-1 text-sm text-red-900 dark:text-red-200">
              {itemLabel(sectionOf(copy, "problems"), problem)}
            </p>
          </section>
        )}

        {/* 1 — what is being accepted, marked rather than captioned. */}
        <section
          aria-labelledby="accept-heading"
          className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="p-4 sm:p-6">
            <h1
              id="accept-heading"
              className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 sm:text-3xl"
            >
              {copy.heading}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
              {copy.subtitle}
            </p>
          </div>
          <h2 className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:px-6">
            {steps.heading}
          </h2>
          <dl className="grid grid-cols-1 gap-px border-t border-gray-200 bg-gray-200 dark:border-gray-700 dark:bg-gray-700 sm:grid-cols-3">
            <div className="bg-white px-4 py-3 dark:bg-gray-900 sm:px-6">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {itemLabel(steps, "type")}
              </dt>
              <dd className="mt-0.5 text-lg font-semibold leading-tight text-gray-900 dark:text-gray-100">
                {templateTitle}
              </dd>
              <dd className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {fillLabel(itemLabel(steps, "type-detail"), { count: aspects.length })}
              </dd>
            </div>
            <div className="bg-white px-4 py-3 dark:bg-gray-900 sm:px-6">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {itemLabel(steps, "mode")}
              </dt>
              <dd className="mt-0.5 text-lg font-semibold leading-tight text-gray-900 dark:text-gray-100">
                {MODE_LABELS[mode]}
              </dd>
              <dd className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {fillLabel(itemLabel(steps, "mode-detail"), {
                  kinds: kinds.map((kind) => OPINION_LABELS[kind]).join(" · "),
                })}
              </dd>
            </div>
            <div className="bg-white px-4 py-3 dark:bg-gray-900 sm:px-6">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {itemLabel(steps, "setting")}
              </dt>
              <dd className="mt-0.5 text-lg font-semibold leading-tight text-gray-900 dark:text-gray-100">
                {fillLabel(itemLabel(steps, "setting-detail"), {
                  setting: SETTING_LABELS[setting],
                })}
              </dd>
              <dd className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {SETTING_DEFINITIONS[setting]}
              </dd>
            </div>
          </dl>
        </section>

        {/* 2 — the decision: acceptance first, the two seats side by side. */}
        <section
          aria-labelledby="acceptance-heading"
          className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="acceptance-heading"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              {acceptance.heading}
            </h2>
            <span className="rounded-full border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-600 dark:border-gray-600 dark:text-gray-300">
              {itemLabel(acceptance, "badge-both")}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{sectionBody(acceptance)}</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {seats.map((seat) => (
              <div
                key={seat.role}
                data-party={seat.role}
                data-accepted={seat.acceptedAt === null ? "no" : "yes"}
                className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-950"
              >
                <SeatHeading wording={seatWording(seat.role)} name={seat.name} />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {fillLabel(itemLabel(acceptance, "answers"), {
                    answered: seat.answered,
                    total: aspects.length,
                  })}
                </p>
                <p className="mt-1 text-xs font-medium text-gray-700 dark:text-gray-200">
                  {seat.acceptedAt === null
                    ? itemLabel(acceptance, "seat-not-accepted")
                    : fillLabel(itemLabel(acceptance, "seat-accepted"), {
                        date: formatDate(seat.acceptedAt),
                      })}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">
            {itemLabel(acceptance, "sealed-note")}
          </p>

          {/* The point of action — one of five honest states, and only one of them posts. */}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            {complete ? (
              <>
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  {itemLabel(acceptance, "both-accepted")}
                </p>
                <Link
                  href={reportHref}
                  className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground"
                >
                  {itemLabel(acceptance, "open-report")}
                </Link>
              </>
            ) : viewerRole === "coach" ? (
              <p className="text-sm text-gray-700 dark:text-gray-200">
                {itemLabel(acceptance, "coach-note")}
              </p>
            ) : viewerAccepted ? (
              <p className="text-sm text-gray-700 dark:text-gray-200">
                {fillLabel(itemLabel(acceptance, "you-accepted"), {
                  other: other?.name ?? itemLabel(acceptance, "seat-counterparty"),
                })}
              </p>
            ) : ownComplete ? (
              <>
                <form method="post" action={acceptAction}>
                  <button
                    type="submit"
                    className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground"
                  >
                    {itemLabel(acceptance, "accept")}
                  </button>
                </form>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {itemLabel(acceptance, "your-turn")}
                </p>
              </>
            ) : (
              <>
                <Link
                  href={answerHref}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 dark:border-gray-600 dark:text-gray-100"
                >
                  {itemLabel(acceptance, "answer-sheet")}
                </Link>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {itemLabel(acceptance, "answer-first")}
                </p>
              </>
            )}
          </div>
        </section>

        {/* 3 — the detail the decision is about, after the decision. */}
        <section
          aria-labelledby="accept-aspects-heading"
          className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="accept-aspects-heading"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              {detail.heading}
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {kinds.map((kind) => OPINION_LABELS[kind]).join(" · ")}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{sectionBody(detail)}</p>

          <div className="mt-3 space-y-2">
            {aspects.map((aspect) => {
              const own = aspect.own;
              return (
                <div
                  key={aspect.itemId}
                  data-aspect={aspect.itemId}
                  className="rounded-md border border-gray-200 px-3 py-2.5 dark:border-gray-700"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {aspect.prompt}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {fillLabel(itemLabel(detail, "scale"), {
                      left: aspect.leftValue,
                      right: aspect.rightValue,
                    })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {/* The viewer's own answers: the only opinions the read path let through. */}
                    <span className="inline-flex flex-wrap items-center gap-1 rounded-full border border-gray-300 px-2 py-0.5 text-xs text-gray-700 dark:border-gray-600 dark:text-gray-200">
                      {itemLabel(detail, "own")}
                      {own === null ? (
                        <span className="text-gray-500 dark:text-gray-400">
                          {": "}
                          {itemLabel(detail, "own-empty")}
                        </span>
                      ) : (
                        kinds.map((kind) => {
                          const score = own[kind];
                          return score === undefined ? null : (
                            <span key={kind} className="font-medium">
                              {OPINION_LABELS[kind]} {score}
                            </span>
                          );
                        })
                      )}
                    </span>
                    {/* Every other seat: the name, and no value to leak. */}
                    {seats
                      .filter((seat) => seat.role !== viewerRole)
                      .map((seat) => (
                        <span
                          key={seat.role}
                          className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-2 py-0.5 text-xs text-gray-600 dark:border-gray-600 dark:text-gray-300"
                        >
                          <Lock className="h-3 w-3" aria-hidden="true" />
                          {seat.name}
                          {" · "}
                          {itemLabel(detail, "sealed")}
                        </span>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </StageColumn>
  );
}
