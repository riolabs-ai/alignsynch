"use client";

// template-ancestor: components/assessment-flow/answer-form.tsx   (variation: one Aspect per screen on the bundle's painted 1–5 band, every pick saved as it is made, and a paged footer in place of one long form)

/**
 * `AspectAnswerCard` — one Aspect of the v2 answer screen (#1128).
 *
 * The ancestor is the flow's own sheet (`answer-form.tsx`): the same five discrete notches, the
 * same `kind:itemId` wire name and the same "no default answer" rule. What changes is the card:
 * **one Aspect**, on the bundle's **painted** scale (`bg-scale-1…5`, the §17 tokens) with the pole
 * words printed under it, a footer that pages instead of a submit, and a write on every pick.
 *
 *   save as you go   every change is posted to `/answers/draft` with `Accept: application/json`,
 *                    which is the partial write (`saveDraftAnswers`); the progress row says `Saved`
 *                    once this Aspect's kinds are all picked and the row landed. A failed write is
 *                    stated (`Not saved — pick again`) instead of being swallowed — a screen that
 *                    says "saved" over a failed write is the silent-success bug with better manners.
 *   one Aspect        the bundle's own rule: the card is `Aspect n of 5`, and the footer's primary
 *                    button is `Next Aspect` (or `Review Answers` past the last one).
 *   blocked until whole  `Next Aspect` is disabled while a kind is unpicked, and the hint says what
 *                    to pick. The *server* refuses the same thing for a no-JavaScript post
 *                    (`?incomplete=1` bounces back here), so the block is a rule and not a styling
 *                    decision.
 *   the form is a plain POST  every footer button is a submit with `name="go"`, so the card works
 *                    with no JavaScript at all: the post saves the picks and answers 303 to the
 *                    place the button named. With JavaScript the same post happens on the pick
 *                    itself, and `Next` is the same button it always was.
 *   not colour-only  the chosen cell takes a ring, a bold numeral and the `deep` underline the
 *                    issue names (§17.3) — three cues, one of which survives a monochrome print.
 *
 * Literal-free: every word is `data/pages/assessment-answer.ts` (E23) except the Opinion names,
 * which are the glossary's own (`OPINION_LABELS`).
 */
import { OPINION_LABELS, opinionKindsFor, type AssessmentMode } from "@/content/assessment";
import type { PageCopy } from "@/content/pages";
import { SCORE_MAX, SCORE_MIN } from "@/content/record";
import type { FlowAspect } from "@/lib/flow/screen";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { useState, useTransition } from "react";

/**
 * The locked 1–5 scale, one class per cell.
 *
 * A map, not `bg-scale-${notch}`: Tailwind's scanner reads source text, not runtime values, so an
 * interpolated class produces no rule and every cell would render unpainted — the same reason
 * `alignment-view.tsx` carries its own copy of this table.
 */
const SCALE_PAINT: Record<number, string> = {
  1: "bg-scale-1",
  2: "bg-scale-2",
  3: "bg-scale-3",
  4: "bg-scale-4",
  5: "bg-scale-5",
};

/** Every cell: the bundle's height, and a target well over the 44 px floor on the way down. */
const CELL = [
  "relative flex h-14 cursor-pointer flex-col items-center justify-center text-foreground",
  "transition-shadow has-[:checked]:z-10 has-[:checked]:font-bold",
  "has-[:checked]:ring-2 has-[:checked]:ring-inset has-[:checked]:ring-foreground",
  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-ring",
  "lg:h-12",
].join(" ");

/** The write's state, as the progress row prints it. */
type SaveState = "idle" | "saving" | "saved" | "failed";

export function AspectAnswerCard({
  copy,
  aspect,
  index,
  total,
  mode,
  draftAction,
  incomplete,
  onSaved,
}: {
  copy: PageCopy;
  aspect: FlowAspect;
  /** 1-based. */
  index: number;
  total: number;
  mode: AssessmentMode;
  /** `/assessment/instances/[id]/answers/draft` — the partial write, from `answerDraftsPath()`. */
  draftAction: string;
  /** The route bounced this Aspect back because its kinds were not all picked. */
  incomplete: boolean;
  onSaved: (state: SaveState) => void;
}) {
  const card = sectionOf(copy, "aspect");
  const kinds = opinionKindsFor(mode);
  const notches: number[] = [];
  for (let notch = SCORE_MIN; notch <= SCORE_MAX; notch += 1) notches.push(notch);

  const [picked, setPicked] = useState<Partial<Record<string, number>>>(() => {
    const initial: Partial<Record<string, number>> = {};
    for (const kind of kinds) {
      const score = aspect.own?.[kind];
      if (score !== undefined) initial[kind] = score;
    }
    return initial;
  });
  const [, startTransition] = useTransition();

  const complete = kinds.every((kind) => picked[kind] !== undefined);

  /**
   * One pick: state first (so the cell fills immediately), then the write.
   *
   * The posted form carries **both** kinds of this Aspect, not just the one that changed: the store
   * writes a row only when the Aspect is whole, so a post with one kind would always be a no-op and
   * the screen would say "Saved" about nothing.
   */
  function pick(kind: string, score: number): void {
    const next = { ...picked, [kind]: score };
    setPicked(next);
    const whole = kinds.every((entry) => next[entry] !== undefined);

    const data = new FormData();
    data.set("item", aspect.itemId);
    data.set("aspect", String(index));
    data.set("go", "save");
    for (const entry of kinds) {
      const value = next[entry];
      if (value !== undefined) data.set(`${entry}:${aspect.itemId}`, String(value));
    }

    onSaved(whole ? "saving" : "idle");
    startTransition(async () => {
      try {
        const response = await fetch(draftAction, {
          method: "POST",
          body: data,
          headers: { accept: "application/json" },
          credentials: "same-origin",
        });
        const body: { ok?: boolean; complete?: boolean } | null = await response
          .json()
          .catch(() => null);
        if (!response.ok || body?.ok !== true) {
          onSaved("failed");
          return;
        }
        onSaved(body.complete === true ? "saved" : "idle");
      } catch {
        onSaved("failed");
      }
    });
  }

  const primary = index >= total ? itemLabel(card, "to-review") : itemLabel(card, "next");

  return (
    <form action={draftAction} method="post" data-aspect-card={aspect.itemId}>
      {/* Where the reader is, as fields for the server: assertions about position, never about
          whose column is written — the seat comes from the party cookie inside the store. */}
      <input type="hidden" name="item" value={aspect.itemId} />
      <input type="hidden" name="aspect" value={index} />

      <section aria-labelledby="aspect-title" className="rounded-lg border bg-card">
        <div className="space-y-1 p-4 lg:px-6 lg:pt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-deep">
            {fillLabel(itemLabel(card, "eyebrow"), { aspect: index, total })}
          </p>
          <h2
            id="aspect-title"
            tabIndex={-1}
            className="text-xl font-bold tracking-tight text-primary focus:outline-none"
          >
            {aspect.prompt}
          </h2>
        </div>

        <div className="space-y-6 px-4 pb-6 lg:px-6">
          {kinds.map((kind) => {
            const rowId = `aspect-poles-${kind}-${aspect.itemId}`;
            const gloss =
              kind === "feel"
                ? itemLabel(card, "feel-gloss")
                : kind === "wish"
                  ? itemLabel(card, "wish-gloss")
                  : null;

            return (
              <fieldset key={kind} className="space-y-2" data-kind={kind}>
                <legend className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-semibold text-primary">{OPINION_LABELS[kind]}</span>
                  {gloss === null ? null : <span className="text-muted-foreground">{gloss}</span>}
                </legend>

                <div className="grid grid-cols-5 overflow-hidden rounded-md ring-1 ring-inset ring-foreground/10">
                  {notches.map((notch) => {
                    const name =
                      notch === SCORE_MIN
                        ? fillLabel(itemLabel(card, "scale-name"), {
                            value: aspect.leftValue,
                            notch,
                          })
                        : notch === SCORE_MAX
                          ? fillLabel(itemLabel(card, "scale-name"), {
                              value: aspect.rightValue,
                              notch,
                            })
                          : String(notch);

                    return (
                      <label
                        key={notch}
                        data-notch={notch}
                        className={`${CELL} ${SCALE_PAINT[notch]}`}
                      >
                        <input
                          type="radio"
                          name={`${kind}:${aspect.itemId}`}
                          value={notch}
                          defaultChecked={aspect.own?.[kind] === notch}
                          aria-label={name}
                          aria-describedby={rowId}
                          onChange={() => pick(kind, notch)}
                          className="peer sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className="text-base leading-none peer-checked:underline peer-checked:decoration-deep peer-checked:decoration-2 peer-checked:underline-offset-4"
                        >
                          {notch}
                        </span>
                        <span
                          aria-hidden="true"
                          className="mt-1 hidden size-1.5 rounded-full bg-foreground peer-checked:block"
                        />
                      </label>
                    );
                  })}
                </div>

                {/* The poles, printed: a score with no Value beside it is a number with no
                    meaning, and the bundle draws both ends under the band. */}
                <div
                  id={rowId}
                  className="flex justify-between gap-2 text-xs text-muted-foreground"
                >
                  <span>
                    {fillLabel(itemLabel(card, "pole-left"), {
                      notch: SCORE_MIN,
                      value: aspect.leftValue,
                    })}
                  </span>
                  <span className="text-right">
                    {fillLabel(itemLabel(card, "pole-right"), {
                      notch: SCORE_MAX,
                      value: aspect.rightValue,
                    })}
                  </span>
                </div>
              </fieldset>
            );
          })}

          {complete ? null : (
            <p
              data-incomplete-hint={incomplete ? "bounced" : "picking"}
              role="alert"
              className="text-sm text-foreground"
            >
              {itemLabel(card, mode === "advanced" ? "hint-advanced" : "hint")}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <button
            type="submit"
            name="go"
            value="back"
            className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-primary hover:bg-mist h-11 lg:h-10"
          >
            {itemLabel(card, "back")}
          </button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="submit"
              name="go"
              value="exit"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-primary hover:bg-mist h-11 lg:h-10"
            >
              {itemLabel(card, "save-exit")}
            </button>
            <button
              type="submit"
              name="go"
              value="next"
              disabled={!complete}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action-hover h-11 lg:h-10 disabled:pointer-events-none disabled:opacity-50"
            >
              {primary}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}
