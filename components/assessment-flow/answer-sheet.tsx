/**
 * template-ancestor: components/assessment-flow/answer-form.tsx   (variation: the same five-notch band, reached from its own route at `/answer`, scoped to the one seat Postgres resolved and prefilled with that seat's own answers)
 *
 * `AnswerSheet` — `/assessment/instances/[instanceId]/answer`, the gated sheet (#427, R2-2).
 *
 * The ancestor is the **live** form the instance screen embeds: same `SEGMENT` arithmetic
 * (44×44 targets, a glyph beside the fill so a selection is not colour-only), five notches from
 * `SCORE_MIN` to `SCORE_MAX`, each notch's accessible name built from the Aspect's own two Values,
 * and the same no-JS `POST` — `name="kind:itemId"`, `value="1".."5"`, which is what
 * `lib/flow/answers.ts::answersFrom` parses back.
 *
 * What varies is **scope**, and the variation is the card:
 *
 * 1. **One row, and it is the viewer's.** R1-E drew both seats so the sheet's shape was on screen
 *    while nothing could be written. This screen is handed one viewer by `readFlowScreen()`
 *    (`viewer.role` resolved from the party cookie's token hash, or the signed-in account, or a
 *    coach membership), so there is exactly one row and it is theirs. The in-progress screen had
 *    no counterparty values to leak because it drew none; this one has none *to receive*, because
 *    `aspects[].own` is the viewer's own score and the read that filled it was filtered by
 *    `visibleRoles()`. The blind rule is therefore a property of the input, not of this markup.
 * 2. **Prefilled, not defaulted.** A radio is checked only where the viewer already answered, and
 *    that answer is read from their own `opinion` row (`own`) — never a default, never the other
 *    party's. An Aspect they left blank stays blank, which is what makes `required` mean
 *    something on the first submit.
 * 3. **No identity field.** The form posts scores and nothing else: no `role`, no hidden seat. A
 *    posted `role` would be an *assertion* the store refuses when it contradicts the cookie, and
 *    the cookie is the only thing that says who is answering — so the sheet never speaks for
 *    itself. `data-answering-as` carries the resolved seat **as markup for the reader**, never as
 *    a field for the server.
 * 4. **Three states, and only one of them is a form** (`lib/flow/answer-gate.ts`):
 *    `sheet` (this seat may answer), `readonly` (the answers are sealed — the viewer's own row is
 *    drawn, disabled, with the reason above it) and `coach` (no sheet at all: a coach membership
 *    reads the relationship and has no answers to give). A coach page has no `<form>` element, not
 *    a disabled one, which is a fact a test reads rather than a promise.
 *
 * The kinds asked are `opinionKindsFor(mode)` — imported, never typed here — so a Basic sheet
 * cannot draw Think and Guess, and the mode is a prop decided by the instance row. Literal-free:
 * every word is `data/pages/assessment-answer.ts` (E23) except the Opinion names and the Mode
 * names, which are the glossary's own (`OPINION_LABELS`, `MODE_LABELS`).
 */
import Link from "next/link";
import {
  MODE_LABELS,
  OPINION_LABELS,
  opinionKindsFor,
  type AssessmentMode,
  type PartyRole,
} from "@/content/assessment";
import type { PageCopy } from "@/content/pages";
import { SCORE_MAX, SCORE_MIN } from "@/content/record";
import { ownScoreOf, type AnswerGate } from "@/lib/flow/answer-gate";
import type { FlowAspect } from "@/lib/flow/screen";
import { fillLabel, itemLabel, pageItemOf, sectionBody, sectionOf } from "@/lib/page-copy";

/**
 * A segment's target box: 44×44 CSS px, the same constant the ancestor uses (SC 2.5.8's floor is
 * 24; Apple's HIG and Material ask 44 and 48).
 */
const TARGET_SIZE = "min-h-[44px] min-w-[44px]";

/**
 * The segment skin, byte-identical to `answer-form.tsx`: a class list is markup, not copy, and
 * importing it would reach the live form's fixture (`assessment-instance`) from a route whose
 * words are `assessment-answer` — which E23 reads as that fixture declaring ids it does not have.
 * The disabled state is `fieldset[disabled]`'s own styling below, not a second class list.
 */
const SEGMENT = [
  TARGET_SIZE,
  "relative flex cursor-pointer items-center justify-center gap-1 rounded-md border-2",
  "border-gray-300 bg-white text-sm font-medium text-gray-700 hover:border-action/60",
  "has-[:checked]:border-action has-[:checked]:bg-action has-[:checked]:font-semibold",
  "has-[:checked]:text-action-foreground",
  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-action has-[:focus-visible]:ring-offset-2",
  "has-[:focus-visible]:ring-offset-white",
  "dark:border-gray-600 dark:bg-gray-950 dark:text-gray-200",
  "dark:has-[:checked]:border-action dark:has-[:checked]:bg-action",
  "dark:has-[:checked]:text-action-foreground dark:has-[:focus-visible]:ring-offset-gray-950",
].join(" ");

/** One seat as the page resolved it: the party row's own name, or the coach's empty one. */
export interface SheetViewer {
  readonly role: PartyRole | "coach";
  readonly name: string;
}

export function AnswerSheet({
  copy,
  aspects,
  gate,
  viewer,
  mode,
  backHref,
}: {
  copy: PageCopy;
  aspects: readonly FlowAspect[];
  gate: AnswerGate;
  viewer: SheetViewer;
  mode: AssessmentMode;
  backHref: string;
}) {
  const sheet = sectionOf(copy, "sheet");
  const rules = sectionOf(copy, "rules");
  const frozen = sectionOf(copy, "frozen");
  const coach = sectionOf(copy, "coach");
  const backLabel = pageItemOf(copy, "back").label;
  const kinds = opinionKindsFor(mode);
  const notches: number[] = [];
  for (let notch = SCORE_MIN; notch <= SCORE_MAX; notch += 1) notches.push(notch);

  const heading = (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
        {copy.heading}
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">{copy.subtitle}</p>
      {/* Which Mode this instance asks — drawn from the row, never chosen here. */}
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {MODE_LABELS[mode]}
      </p>
    </header>
  );

  const back = (
    <p>
      <Link href={backHref} className="text-sm font-medium text-action hover:underline">
        {backLabel}
      </Link>
    </p>
  );

  /**
   * A coach has no seat to answer as, so the page is a band and a way back: no `<form>`, no
   * radios, nothing that could be read as "fill this in". The badge is drawn from the membership
   * the read resolved, so the reader knows which hat this view is on.
   */
  if (gate.state === "coach") {
    return (
      <div className="space-y-6">
        {heading}
        <section
          aria-labelledby="answer-sheet-coach-heading"
          data-coach-badge="true"
          className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {itemLabel(coach, "coach-badge")}
          </p>
          <h2
            id="answer-sheet-coach-heading"
            className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100"
          >
            {coach.heading}
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{sectionBody(coach)}</p>
          <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">
            {itemLabel(coach, "coach-note")}
          </p>
        </section>
        {back}
      </div>
    );
  }

  const seat =
    gate.role === "initiator"
      ? itemLabel(sheet, "seat-initiator")
      : itemLabel(sheet, "seat-counterparty");

  /**
   * The Aspect band. Each radio's checked state is the viewer's own stored score, and its name is
   * `kind:itemId` — the wire format the endpoint parses. Without a form around it (`readonly`), the
   * same markup is drawn inside a disabled `fieldset`, so what the person said is legible and
   * nothing can be re-submitted.
   */
  const fields = aspects.map((aspect) => {
    const polesId = `answer-poles-${aspect.itemId}`;
    const scale = fillLabel(itemLabel(sheet, "scale"), {
      left: aspect.leftValue,
      right: aspect.rightValue,
    });

    return (
      <fieldset
        key={aspect.itemId}
        data-aspect={aspect.itemId}
        className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
      >
        <legend className="px-1 text-base font-semibold text-gray-900 dark:text-gray-100">
          {aspect.prompt}
        </legend>
        <p id={polesId} className="mb-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
          {scale}
        </p>

        {kinds.map((kind) => (
          <fieldset key={kind} data-kind={kind} className="mt-4">
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {OPINION_LABELS[kind]}
            </legend>

            <div className="mt-2 grid grid-cols-5 gap-1">
              {notches.map((notch) => {
                /**
                 * The accessible name: the pole word at either end (so a screen reader says the
                 * Value, not a bare digit) and the numeral between them, which the group's own
                 * position already announces as "N of 5".
                 */
                const name =
                  notch === SCORE_MIN
                    ? `${aspect.leftValue} — ${notch}`
                    : notch === SCORE_MAX
                      ? `${aspect.rightValue} — ${notch}`
                      : `${notch}`;

                return (
                  <label key={notch} data-notch={notch} className={SEGMENT}>
                    <input
                      type="radio"
                      name={`${kind}:${aspect.itemId}`}
                      value={notch}
                      required={notch === SCORE_MIN}
                      defaultChecked={ownScoreOf(aspect, kind) === notch}
                      aria-label={name}
                      aria-describedby={polesId}
                      className="peer sr-only"
                    />
                    <span aria-hidden="true" className="hidden peer-checked:inline">
                      {"✓"}
                    </span>
                    <span aria-hidden="true">{notch}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </fieldset>
    );
  });

  return (
    <div className="space-y-6">
      {heading}

      <section
        aria-labelledby="answer-sheet-heading"
        className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
      >
        {/* Who this sheet belongs to, from the read that resolved it — never a form field. */}
        <p
          data-answering-as={gate.role}
          className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
        >
          {fillLabel(itemLabel(sheet, "answering-as"), { name: viewer.name, seat })}
        </p>
        <h2
          id="answer-sheet-heading"
          className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100"
        >
          {sheet.heading}
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{sectionBody(sheet)}</p>
        <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">
          {itemLabel(sheet, "blind-rule")}
        </p>
      </section>

      {gate.state === "sheet" ? (
        <form action={gate.action ?? undefined} method="post" className="space-y-6">
          {fields}

          <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {rules.heading}
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
              <li>{itemLabel(rules, "mode-fixed")}</li>
              <li>{itemLabel(rules, "setting")}</li>
            </ul>
          </section>

          {/* The point of action: the control and what it will do, side by side. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="submit"
              aria-describedby="answer-sheet-submit-note"
              className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action/90"
            >
              {itemLabel(sheet, gate.answered > 0 ? "resubmit" : "submit")}
            </button>
            <p id="answer-sheet-submit-note" className="text-xs text-gray-600 dark:text-gray-300">
              {itemLabel(sheet, "submit-note")}
            </p>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <h2 className="text-xl font-semibold text-amber-900 dark:text-amber-200">
              {frozen.heading}
            </h2>
            <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">{sectionBody(frozen)}</p>
            <p className="mt-3 text-sm font-medium text-amber-900 dark:text-amber-200">
              {itemLabel(frozen, "frozen-note")}
            </p>
          </section>
          <fieldset disabled className="space-y-6 opacity-80">
            {fields}
          </fieldset>
        </div>
      )}

      {back}
    </div>
  );
}
