// template-ancestor: components/assessment-flow/answer-sheet.tsx   (variation: the review position — one summary row per Aspect with a Change link, and the seal as a form that carries the whole sheet, instead of a card of radios)

/**
 * `AnswerReview` — `Check Your Answers`, the last position of the v2 answer sheet (#1128).
 *
 * The bundle's review is one row per Aspect ("Feel n · Wish n") with a `Change` link and one
 * `Submit Answers` at the foot. Two mechanical facts shape the port:
 *
 *   the seal is the whole sheet   `/answers` accepts a **complete** sheet or refuses, so the submit
 *                                 is a plain form carrying every Aspect's saved picks as
 *                                 `kind:itemId` fields — the same wire format the one-page sheet
 *                                 posted. Nothing about the endpoint changed; the screen that fills
 *                                 it in did.
 *   `Change` is a position          it links back to `?aspect=n` on this same route, which keeps the
 *                                 answers (they are rows) and lands the reader on that card. No
 *                                 modal, no second editor.
 *
 * A row with no saved answer is drawn as the dash the bundle uses and the submit is refused here
 * rather than at the endpoint: the store would answer 409 `incomplete`, and a button that can only
 * be refused is not a control. `sealed` drops `Change` and the submit entirely — that is the
 * read-only state (the viewer accepted this session), where the review is the record of what they
 * said.
 *
 * Literal-free: `data/pages/assessment-answer.ts` (E23) plus `OPINION_LABELS`.
 */
import { opinionKindsFor, type AssessmentMode } from "@/content/assessment";
import type { PageCopy } from "@/content/pages";
import type { Score } from "@/content/record";
import { aspectComplete } from "@/lib/flow/answer-position";
import type { FlowAspect } from "@/lib/flow/screen";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/** The dash a row shows while its Aspect has not been answered — the bundle's own glyph. */
function scoreOf(aspect: FlowAspect, kind: string): Score | undefined {
  const own = aspect.own;
  if (own === null) return undefined;
  return (own as Record<string, Score | undefined>)[kind];
}

export function AnswerReview({
  copy,
  aspects,
  mode,
  answersHref,
  changeHrefFor,
  exitHref,
  sealed,
}: {
  copy: PageCopy;
  aspects: readonly FlowAspect[];
  mode: AssessmentMode;
  /** `/assessment/instances/[id]/answers` — the seal. */
  answersHref: string;
  /** `?aspect=n` for one Aspect, from `answerAspectPath()`. */
  changeHrefFor: (index: number) => string;
  exitHref: string;
  /** The viewer has accepted: the rows are the record, so nothing here may change them. */
  sealed: boolean;
}) {
  const review = sectionOf(copy, "review");
  const kinds = opinionKindsFor(mode);
  const whole = aspects.every((aspect) => aspectComplete(aspect, mode));

  return (
    <section aria-labelledby="review-title" className="rounded-lg border bg-card">
      <div className="space-y-1 p-4 lg:px-6 lg:pt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-deep">
          {itemLabel(review, "eyebrow")}
        </p>
        <h2
          id="review-title"
          tabIndex={-1}
          className="text-xl font-bold tracking-tight text-primary focus:outline-none"
        >
          {review.heading}
        </h2>
        <p className="text-base text-foreground">{sectionBody(review)}</p>
      </div>

      <ol className="mx-4 divide-y rounded-lg border lg:mx-6" data-review-list="">
        {aspects.map((aspect, index) => {
          const values = Object.fromEntries(
            kinds.map((kind) => [kind, scoreOf(aspect, kind) ?? itemLabel(review, "missing")]),
          ) as Record<string, string | number>;

          return (
            <li
              key={aspect.itemId}
              data-review-row={aspect.itemId}
              className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{aspect.prompt}</p>
                <p className="text-sm text-muted-foreground">
                  {fillLabel(
                    itemLabel(review, mode === "advanced" ? "summary-advanced" : "summary-basic"),
                    values,
                  )}
                </p>
              </div>
              {sealed ? null : (
                <a
                  href={changeHrefFor(index + 1)}
                  data-change={aspect.itemId}
                  aria-label={fillLabel(itemLabel(review, "change-name"), {
                    aspect: aspect.prompt,
                  })}
                  className="self-start text-sm font-medium text-primary underline underline-offset-4 sm:self-auto"
                >
                  {itemLabel(review, "change")}
                </a>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        {whole || sealed ? null : (
          <p className="text-xs text-muted-foreground">
            {itemLabel(sectionOf(copy, "aspect"), mode === "advanced" ? "hint-advanced" : "hint")}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <a
            href={exitHref}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-primary hover:bg-mist h-11 lg:h-10"
          >
            {itemLabel(review, "save-exit")}
          </a>
          {sealed ? null : (
            <form action={answersHref} method="post" data-review-submit="">
              {/* The seal carries the whole sheet: one hidden value per (Aspect, kind), the same
                  `kind:itemId` wire format the one-page sheet posted. */}
              {aspects.map((aspect) =>
                kinds.map((kind) => {
                  const score = scoreOf(aspect, kind);
                  return score === undefined ? null : (
                    <input
                      key={`${kind}:${aspect.itemId}`}
                      type="hidden"
                      name={`${kind}:${aspect.itemId}`}
                      value={score}
                    />
                  );
                }),
              )}
              <button
                type="submit"
                disabled={!whole}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action-hover h-11 lg:h-10 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
              >
                {itemLabel(review, "submit")}
              </button>
            </form>
          )}
        </div>
      </div>

      {sealed ? null : (
        <p className="px-4 pb-4 text-xs text-muted-foreground lg:px-6">
          {itemLabel(review, "submit-note")}
        </p>
      )}
    </section>
  );
}
