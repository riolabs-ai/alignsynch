/**
 * The answer sheet: every Aspect, and the scores **the instance's mode** asks (#146, #213, #273).
 *
 * `opinionKindsFor(mode)` is the list of kinds asked — `feel` and `wish` for Basic Mode, all
 * four in the glossary's order for Advanced — imported from `content/assessment.ts` rather
 * than typed here, so "what this sheet asks" is a fact about the model and not about this
 * component's markup. The field names are `${kind}:${itemId}`, which is what the submit
 * endpoint parses back into a `Map` (`lib/flow/answers.ts`), and nothing else about the form
 * is stateful: it is a `POST` with no JavaScript.
 *
 * **Five segments, not a slider** (#273). The spec's mockup marks three notches at 1–3–5,
 * which teaches a three-point scale and leaves 2 and 4 as targets nobody can see — and the
 * stored integer *is* the Gap's operand (`gapOf(left, right)`), so a control that cannot be
 * set exactly corrupts the arithmetic. A native radio group is the APG's pattern for seven
 * or fewer discrete choices, keeps the no-JS `POST` byte-identical (`name="kind:itemId"`,
 * `value="1".."5"`), and announces "3 of 5, selected" for free. `docs/specs/ux-input.md`
 * records the research and the rejected alternatives.
 *
 * The markup is one `<fieldset>` per Aspect (legend: the prompt), one nested `<fieldset>` per
 * opinion kind (legend: Feel / Wish / Think / Guess), five radios in each. Each radio's
 * accessible name is its `aria-label` — the pole word at either end, the numeral between —
 * and every radio is `aria-describedby` the `leftValue — rightValue` line, so no digit is
 * ever announced outside its band. Nothing is checked unless the viewer already answered
 * that kind: a pre-selected answer is an answer the person did not give (GOV.UK), and the
 * blank state is what makes `required` mean something.
 *
 * The selected segment is distinguishable **without colour** — a check glyph and a semibold
 * numeral beside the fill — and every segment is ≥ 44×44 CSS px (SC 2.5.8 asks 24; the touch
 * guidelines ask 44). The focused segment carries a ring, so keyboard use is visible; arrow
 * keys move within a group because that is what a native radio group does.
 *
 * The mode is a **prop**, decided by the instance row, never a control: a sheet that could
 * switch would let one party answer Basic and the other Advanced on one relationship, which
 * is the comparison the mode column exists to prevent.
 *
 * The option values are the 1..5 band from `SCORE_MIN`/`SCORE_MAX`, and the two ends of each
 * Aspect are printed above the band — a score with no Value beside it is a number with no
 * meaning, which is the one thing this screen must never show.
 *
 * Literal-free: the labels are `data/pages/assessment-instance.ts` (E23).
 */
import { opinionKindsFor, type AssessmentMode } from "@/content/assessment";
import { SCORE_MAX, SCORE_MIN } from "@/content/record";
import type { PageCopy } from "@/content/pages";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import type { FlowAspect } from "@/lib/flow/screen";

/**
 * A segment's target box: 44×44 CSS px (SC 2.5.8's floor is 24; Apple's HIG and Material ask
 * 44 and 48). One constant, so the acceptance can read the size off the rendered class list
 * rather than off a screenshot.
 */
const TARGET_SIZE = "min-h-[44px] min-w-[44px]";

/**
 * The segment skin. `border-2` is on every segment, checked or not, so checking one does not
 * reflow the row. The checked state adds weight and a glyph beside the fill, so the selection
 * survives a colour-blind reader and a monochrome print. `has-[:checked]` and
 * `has-[:focus-visible]` read the wrapped input's own state — no JavaScript, no React state.
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

export function AnswerForm({
  copy,
  aspects,
  action,
  hasAnswers,
  mode,
}: {
  copy: PageCopy;
  aspects: readonly FlowAspect[];
  action: string;
  hasAnswers: boolean;
  mode: AssessmentMode;
}) {
  const section = sectionOf(copy, "answer");
  const body = itemLabel(section, mode === "advanced" ? "body-advanced" : "body-basic");
  const kinds = opinionKindsFor(mode);
  const notches: number[] = [];
  for (let notch = SCORE_MIN; notch <= SCORE_MAX; notch += 1) notches.push(notch);

  return (
    <form action={action} method="post" className="mt-8 space-y-4">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{section.heading}</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300">{body}</p>

      {aspects.map((aspect) => {
        const polesId = `poles-${aspect.itemId}`;

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
              <span>{aspect.leftValue}</span>
              <span className="mx-2 text-gray-400 dark:text-gray-500">{"—"}</span>
              <span>{aspect.rightValue}</span>
            </p>

            {kinds.map((kind) => (
              <fieldset key={kind} data-kind={kind} className="mt-4">
                <legend className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {itemLabel(section, kind)}
                </legend>

                <div className="mt-2 grid grid-cols-5 gap-1">
                  {notches.map((notch) => {
                    /**
                     * The accessible name: the pole word at either end (so a screen reader
                     * says the Value, not a bare digit) and the numeral between them, which
                     * the group's own position already announces as "N of 5".
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
                          id={`${kind}-${aspect.itemId}-${notch}`}
                          name={`${kind}:${aspect.itemId}`}
                          value={notch}
                          required={notch === SCORE_MIN}
                          defaultChecked={aspect.own?.[kind] === notch}
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

      <button
        type="submit"
        className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action/90"
      >
        {itemLabel(section, hasAnswers ? "resubmit" : "submit")}
      </button>
    </form>
  );
}
