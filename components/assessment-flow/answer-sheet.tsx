/**
 * template-ancestor: components/assessment-flow/answer-form.tsx   (variation: the same five-notch band, drawn for both seats with every control disabled — the screen without the write)
 *
 * `AnswerSheetInProgress` — the answer screen shipped as **in-progress UI** (#409, R1-E).
 *
 * A separate module from `answer-form.tsx` on purpose. That component is the **live** sheet: it
 * posts to `/assessment/instances/[instanceId]/answers`, it is reached from the instance screen,
 * and its ids belong to `data/pages/assessment-instance.ts`. This screen renders the same shape
 * with no write behind it, and its words belong to `data/pages/assessment-answer.ts` — two
 * surfaces, two fixtures. E23 checks every copy id a file asks against the fixture of each route
 * that reaches it, so folding both into one file would have forced the instance's fixture to
 * carry sentences it never renders, and that is the duplication the ratchet exists to prevent.
 *
 * What it keeps from the ancestor is the arithmetic of the band: `SEGMENT` (44×44 targets, a
 * glyph beside the fill so a selection is not colour-only), five notches from `SCORE_MIN` to
 * `SCORE_MAX`, and each notch's accessible name built from the Aspect's own two Values.
 *
 * Three honest differences, all visible on the page:
 *
 * 1. **One row per party.** The live sheet asks the viewer's row only. This screen has no party
 *    session to resolve, so it draws both seats — named from their `party` rows — so the sheet's
 *    full shape is on screen. Neither row carries a score.
 * 2. **Every control is disabled.** The not-wired notice sits above the first Aspect and the
 *    submit's own note sits beside the submit, `aria-describedby`-linked: the reason is at the
 *    point of action, for a sighted reader and for a screen reader alike. A control that cannot
 *    work says so; nothing here ever reports a save that did not happen.
 * 3. **The blind rule is on the page**, above the sheet: until both parties accept, neither sees
 *    the other's answers. A sentence in the fixture, not a tooltip.
 *
 * The kinds asked are `opinionKindsFor(mode)` — imported, never typed here — so a Basic screen
 * cannot draw Think and Guess. The Setting is printed because it is the bar these answers will
 * later be judged against, and it changes no question.
 *
 * Literal-free: every word is `data/pages/assessment-answer.ts` (E23) except the four Opinion
 * names and the two Setting names, which are the glossary's own (`OPINION_LABELS`,
 * `SETTING_LABELS`).
 */
import Link from "next/link";
import {
  MODE_LABELS,
  OPINION_LABELS,
  SETTING_LABELS,
  opinionKindsFor,
  type AlignmentSetting,
  type AssessmentMode,
  type PartyRole,
} from "@/content/assessment";
import { SCORE_MAX, SCORE_MIN } from "@/content/record";
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/**
 * A segment's target box: 44×44 CSS px, the same constant `answer-form.tsx` uses (SC 2.5.8's
 * floor is 24; Apple's HIG and Material ask 44 and 48).
 */
const TARGET_SIZE = "min-h-[44px] min-w-[44px]";

/**
 * The segment skin, copied verbatim from `answer-form.tsx` so the two bands match — the same
 * choice `components/v1/opinion-sheet.tsx` made, and for the same reason: a class list is markup,
 * not copy, and importing it would reach the live form's fixture (`assessment-instance`) from a
 * route whose words are `assessment-answer`, which E23 reads as that fixture declaring ids it
 * does not have.
 *
 * The disabled state is the one difference: `cursor-not-allowed opacity-60` on the label, added
 * at the call site below so this list stays byte-identical to the ancestor.
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

/** One Aspect as this sheet draws it: the words and the band's two ends, no answer. */
export interface SheetAspect {
  readonly itemId: string;
  readonly prompt: string;
  readonly leftValue: string;
  readonly rightValue: string;
}

/** One seat, as the sheet names it. `name` is the party row's own; nothing is invented. */
export interface SheetParty {
  readonly role: PartyRole;
  readonly name: string;
}

export function AnswerSheetInProgress({
  copy,
  aspects,
  parties,
  mode,
  setting,
  backHref,
}: {
  copy: PageCopy;
  aspects: readonly SheetAspect[];
  parties: readonly SheetParty[];
  mode: AssessmentMode;
  setting: AlignmentSetting;
  backHref: string;
}) {
  const section = sectionOf(copy, "sheet");
  const rules = sectionOf(copy, "rules");
  const kinds = opinionKindsFor(mode);
  const notches: number[] = [];
  for (let notch = SCORE_MIN; notch <= SCORE_MAX; notch += 1) notches.push(notch);
  const noteId = "answer-sheet-not-wired";

  return (
    <form className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          {copy.heading}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">{copy.subtitle}</p>
        {/* Which Mode and Setting this instance carries — drawn from the row, never chosen here. */}
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {MODE_LABELS[mode]}
          <span className="mx-1.5 text-gray-400 dark:text-gray-500">{"·"}</span>
          {SETTING_LABELS[setting]}
        </p>
      </div>

      {/* The honest state of the screen, before the sheet rather than after a click. */}
      <section
        aria-labelledby="answer-sheet-heading"
        className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
      >
        <h2
          id="answer-sheet-heading"
          className="text-xl font-semibold text-gray-900 dark:text-gray-100"
        >
          {section.heading}
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{sectionBody(section)}</p>
        <p
          id={noteId}
          className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          {itemLabel(section, "not-wired")}
        </p>
        <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">
          {itemLabel(section, "blind-rule")}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {itemLabel(section, "row-help")}
        </p>
      </section>

      {aspects.map((aspect) => {
        const polesId = `preview-poles-${aspect.itemId}`;

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
              {fillLabel(itemLabel(section, "scale"), {
                left: aspect.leftValue,
                right: aspect.rightValue,
              })}
            </p>

            <div className="space-y-3">
              {parties.map((party) => {
                return (
                  <fieldset
                    key={party.role}
                    data-party={party.role}
                    className="rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
                  >
                    <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-gray-100">
                      {fillLabel(itemLabel(section, "seat-row"), {
                        name: party.name,
                        seat:
                          party.role === "initiator"
                            ? itemLabel(section, "seat-initiator")
                            : itemLabel(section, "seat-counterparty"),
                      })}
                    </legend>

                    {kinds.map((kind) => (
                      <fieldset key={kind} data-kind={kind} className="mt-3">
                        <legend className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          {OPINION_LABELS[kind]}
                        </legend>

                        <div className="mt-2 grid grid-cols-5 gap-1">
                          {notches.map((notch) => {
                            const name =
                              notch === SCORE_MIN
                                ? `${aspect.leftValue} — ${notch}`
                                : notch === SCORE_MAX
                                  ? `${aspect.rightValue} — ${notch}`
                                  : `${notch}`;

                            return (
                              <label
                                key={notch}
                                data-notch={notch}
                                className={`${SEGMENT} cursor-not-allowed opacity-60`}
                              >
                                <input
                                  type="radio"
                                  disabled
                                  name={`${party.role}:${kind}:${aspect.itemId}`}
                                  value={notch}
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
              })}
            </div>
          </fieldset>
        );
      })}

      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{rules.heading}</h2>
        <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
          <li>{itemLabel(rules, "mode-fixed")}</li>
          <li>{fillLabel(itemLabel(rules, "setting"), { setting: SETTING_LABELS[setting] })}</li>
        </ul>
      </section>

      {/* The point of action: the disabled control and its reason, side by side. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled
          aria-describedby={noteId}
          className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {itemLabel(section, "submit")}
        </button>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          {itemLabel(section, "submit-note")}
        </p>
      </div>

      <p>
        <Link href={backHref} className="text-sm font-medium text-action hover:underline">
          {itemLabel(section, "back")}
        </Link>
      </p>
    </form>
  );
}
