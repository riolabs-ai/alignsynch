/**
 * The answer sheet: every Aspect, and the scores **the instance's mode** asks (#146, #213).
 *
 * `opinionKindsFor(mode)` is the list of kinds asked — `feel` and `wish` for Basic Mode, all
 * four in the glossary's order for Advanced — imported from `content/assessment.ts` rather
 * than typed here, so "what this sheet asks" is a fact about the model and not about this
 * component's markup. The field names are `${kind}:${itemId}`, which is what the submit
 * endpoint parses back into a `Map` (`lib/flow/answers.ts`), and nothing else about the form
 * is stateful: it is a `POST` with no JavaScript.
 *
 * The mode is a **prop**, decided by the instance row, never a control: a sheet that could
 * switch would let one party answer Basic and the other Advanced on one relationship, which
 * is the comparison the mode column exists to prevent. Basic renders exactly the two selects
 * it always did — same names, same required semantics, same labels — so nothing a Basic user
 * sees changes.
 *
 * The option values are the 1..5 band from `SCORE_MIN`/`SCORE_MAX`, and the two ends of
 * each Aspect are printed above the selects — a score with no Value beside it is a number
 * with no meaning, which is the one thing this screen must never show.
 *
 * Literal-free: the labels are `data/pages/assessment-instance.ts` (E23).
 */
import { opinionKindsFor, type AssessmentMode } from "@/content/assessment";
import { SCORE_MAX, SCORE_MIN } from "@/content/record";
import type { PageCopy } from "@/content/pages";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import type { FlowAspect } from "@/lib/flow/screen";

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

      {aspects.map((aspect) => (
        <fieldset
          key={aspect.itemId}
          data-aspect={aspect.itemId}
          className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
        >
          <legend className="px-1 text-base font-semibold text-gray-900 dark:text-gray-100">
            {aspect.prompt}
          </legend>
          <p className="mb-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{aspect.leftValue}</span>
            <span className="mx-2 text-gray-400 dark:text-gray-500">{"—"}</span>
            <span>{aspect.rightValue}</span>
          </p>

          {kinds.map((kind) => (
            <label
              key={kind}
              className="mr-4 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
              htmlFor={`${kind}-${aspect.itemId}`}
            >
              <span className="capitalize">{itemLabel(section, kind)}</span>
              <select
                id={`${kind}-${aspect.itemId}`}
                name={`${kind}:${aspect.itemId}`}
                required
                defaultValue={aspect.own?.[kind] ?? ""}
                className="rounded-md border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-950"
              >
                {aspect.own === null ? <option value="" /> : null}
                {notches.map((notch) => (
                  <option key={notch} value={notch}>
                    {notch}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
      ))}

      <button
        type="submit"
        className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action/90"
      >
        {itemLabel(section, hasAnswers ? "resubmit" : "submit")}
      </button>
    </form>
  );
}
