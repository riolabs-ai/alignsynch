/**
 * template-ancestor: components/v1/accept-session.tsx   (variation: server-rendered from the instance's own rows, and honest about the missing write — every acceptance control is disabled and the reason sits beside it)
 *
 * `AcceptSession` — the acceptance step shipped as **in-progress UI** (#409, R1-E).
 *
 * The page is read in the order a decision is made, the same order the v1 prototype settled on:
 *
 *   1. **What is being accepted** — Type, Mode and Setting, marked rather than captioned.
 *   2. **The decision** — the two seats side by side, each with the facts this build actually
 *      holds, then the accept control.
 *   3. **The Aspect detail** — beneath the decision, never before it, with both columns sealed.
 *
 * **What this screen refuses to claim.** The database has no column that stores an acceptance
 * (`db/migrations/` has no `accepted_at` on `party` or `instance`), so no seat can honestly show
 * one. Each panel therefore draws the one fact the row does carry — how many of the instance's
 * Aspects that party has answered (`readInstanceBundle().answerCounts`, one `opinion` row per
 * party per Aspect) — and says in words that acceptance is not recorded. A badge reading
 * "Accepted" would be a status the system does not measure, which is exactly the defect this
 * card forbids; so would a success toast for an accept that never happened.
 *
 * **The blind rule is stated, not assumed.** Until both parties accept, neither sees the other's
 * answers — so the Aspect detail below the decision draws every Opinion column sealed, for both
 * seats, rather than inventing a viewer. That is not a missing feature: it is the rule, drawn.
 *
 * Literal-free: every word is `data/pages/assessment-accept.ts` (E23) except the model's own
 * glossary — `MODE_LABELS`, `SETTING_LABELS`, `SETTING_DEFINITIONS`, `OPINION_LABELS` — the same
 * vocabulary `instance-view.tsx` draws its mode badge from.
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
  type PartyRole,
} from "@/content/assessment";
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/** One Aspect as the detail band draws it: the words and the band's two ends. */
export interface AcceptAspect {
  readonly itemId: string;
  readonly prompt: string;
  readonly leftValue: string;
  readonly rightValue: string;
}

/** One seat: the party row's own name, and how many Aspects it has answered. */
export interface AcceptParty {
  readonly role: PartyRole;
  readonly name: string;
  /** `opinion` rows for this role — one per Aspect the party has answered, never a score. */
  readonly answered: number;
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
  parties,
  aspects,
  mode,
  setting,
  templateTitle,
  backHref,
}: {
  copy: PageCopy;
  parties: readonly AcceptParty[];
  aspects: readonly AcceptAspect[];
  mode: AssessmentMode;
  setting: AlignmentSetting;
  templateTitle: string;
  backHref: string;
}) {
  const steps = sectionOf(copy, "steps");
  const acceptance = sectionOf(copy, "acceptance");
  const detail = sectionOf(copy, "aspects");
  const kinds = opinionKindsFor(mode);
  const noteId = "accept-not-wired";

  const seatWording = (role: PartyRole) =>
    role === "initiator"
      ? itemLabel(acceptance, "seat-initiator")
      : itemLabel(acceptance, "seat-counterparty");

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <p>
        <Link href={backHref} className="text-sm font-medium text-action hover:underline">
          {itemLabel(acceptance, "back")}
        </Link>
      </p>

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
          <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">{copy.subtitle}</p>
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
              {fillLabel(itemLabel(steps, "setting-detail"), { setting: SETTING_LABELS[setting] })}
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
          {parties.map((party) => (
            <div
              key={party.role}
              data-party={party.role}
              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-950"
            >
              <SeatHeading wording={seatWording(party.role)} name={party.name} />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {fillLabel(itemLabel(acceptance, "answers"), {
                  answered: party.answered,
                  total: aspects.length,
                })}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {itemLabel(acceptance, "acceptance-unrecorded")}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">
          {itemLabel(acceptance, "sealed-note")}
        </p>

        {/* The point of action: the control, disabled, with its reason beside it. */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled
            aria-describedby={noteId}
            className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {itemLabel(acceptance, "accept")}
          </button>
          <p id={noteId} className="text-xs text-gray-600 dark:text-gray-300">
            {itemLabel(acceptance, "not-wired")}
          </p>
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
          {aspects.map((aspect) => (
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
                {parties.map((party) => (
                  <span
                    key={party.role}
                    className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-2 py-0.5 text-xs text-gray-600 dark:border-gray-600 dark:text-gray-300"
                  >
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    {party.name}
                    {" · "}
                    {itemLabel(detail, "sealed")}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
