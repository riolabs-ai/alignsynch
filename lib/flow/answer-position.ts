/**
 * Where the answer sheet is, and where its buttons take the reader (#1128).
 *
 * The v2 screen asks **one Aspect at a time**, so the surface needs a position: which Aspect is
 * being drawn, which one a return should resume at, and what `Next Aspect` / `Review Answers`
 * advance to. All three are functions of the viewer's own saved answers plus one query string, and
 * this module is the single home for all of them.
 *
 * **Resume is derived, never stored.** The screen used to draw every Aspect at once, so there was
 * no position to keep; the bundle's resume banner ("Welcome back. Your answers are saved. You're
 * on Aspect 3 of 5.") is a statement about the rows the read already returned — `aspects[].own` is
 * the viewer's own score, filled only from their own `opinion` rows, so the first `null` *is* the
 * answer to "where were we". A column would be a second copy of that fact and would go stale the
 * first time a row was written by anything but this screen.
 *
 * **`?aspect=` is a position, not a state.** The bundle drops every prototype query switch
 * (`?state=`, `?role=`) because those named facts the app derives from rows; a position is not
 * such a fact — `Change` on the review has to address one Aspect, and a keyboard user's Back has to
 * land where they were — so it is the one parameter this route keeps, and it is a *hint*: a value
 * that is not `1..n` (or `review`) falls back to the derived resume position rather than rendering
 * a blank card.
 *
 * Pure: no `pg`, no React, no clock. `tests/assessment-answer-resume.test.ts` drives the whole
 * derivation, including the reload case the card's acceptance line names (two of five answered,
 * resume at three).
 */
import { opinionKindsFor, type AssessmentMode } from "@/content/assessment";
import type { FlowAspect } from "@/lib/flow/screen";

/** How many of the instance's Aspects the viewer has answered — the progress line's numerator. */
export function answeredCount(aspects: readonly Pick<FlowAspect, "own">[]): number {
  return aspects.filter((aspect) => aspect.own !== null).length;
}

/**
 * The Aspect a return should land on: the first one the viewer has not answered, 1-based.
 *
 * When every Aspect is answered there is nothing to resume at, so the last one is drawn — its
 * footer says `Review Answers`, which is the honest next move and keeps the screen from opening on
 * an empty review the reader did not ask for.
 */
export function resumeIndexOf(aspects: readonly Pick<FlowAspect, "own">[]): number {
  const first = aspects.findIndex((aspect) => aspect.own === null);
  if (first !== -1) return first + 1;
  return Math.max(aspects.length, 1);
}

/**
 * Does this Aspect carry every Opinion kind its Mode asks?
 *
 * `Next Aspect` is blocked until it does, and the hint names the two rows the *prototype* draws.
 * The kinds are `opinionKindsFor(mode)` — the same list the radios are built from — so an Advanced
 * sheet cannot advance on Feel and Wish alone, and a Basic sheet is not asked for a pair no control
 * on the screen offers.
 */
export function aspectComplete(aspect: Pick<FlowAspect, "own">, mode: AssessmentMode): boolean {
  const own = aspect.own;
  if (own === null) return false;
  return opinionKindsFor(mode).every((kind) => own[kind] !== undefined);
}

/** The sheet's position, as the page resolved it. `index` is 1-based. */
export interface SheetPosition {
  readonly index: number;
  readonly total: number;
  /** The review screen, which is a position rather than a page of its own. */
  readonly review: boolean;
}

/**
 * Resolve `?aspect=` against the sheet.
 *
 * `review` addresses the review screen (`Change` links come back to an Aspect; `Review Answers`
 * goes forward to this). Anything else that is not an integer inside `1..total` is not a position
 * this sheet has, and the reader gets the derived resume point instead of a blank card.
 */
export function positionOf(
  aspects: readonly Pick<FlowAspect, "own">[],
  requested: string | undefined,
): SheetPosition {
  const total = Math.max(aspects.length, 1);
  if (requested === "review") return { index: total, total, review: true };
  const parsed = Number(requested);
  if (
    requested !== undefined &&
    requested.trim() !== "" &&
    Number.isInteger(parsed) &&
    parsed >= 1 &&
    parsed <= total
  ) {
    return { index: parsed, total, review: false };
  }
  return { index: resumeIndexOf(aspects), total, review: false };
}

/** Where `Back` goes: one Aspect earlier, never past the first. */
export function previousIndexOf(position: SheetPosition): number {
  return Math.max(position.index - 1, 1);
}

/**
 * What the primary button advances to.
 *
 * `blocked` is the bundle's rule for an incomplete Aspect ("Pick a number for Feel and for Wish to
 * continue."): the button exists, is disabled, and the hint beneath says why. Past the last Aspect
 * the target is the review — there is nowhere else to go.
 */
export function advanceOf(
  position: SheetPosition,
  complete: boolean,
):
  | { readonly kind: "blocked" }
  | { readonly kind: "review" }
  | { readonly kind: "aspect"; readonly index: number } {
  if (!complete) return { kind: "blocked" };
  if (position.review) return { kind: "review" };
  if (position.index >= position.total) return { kind: "review" };
  return { kind: "aspect", index: position.index + 1 };
}
