/**
 * The answer sheet's save state and its sealed band — the two halves of one row in
 * `docs/specs/v2-rectification.md` (`guides/shared/answer-the-assessment.md`).
 *
 * The doc promises a progress line and a save chip. The sealed sheet — the only state the demo
 * seed can reach, because its instance is already accepted from both seats (measured 2026-11-19,
 * initiator *and* counterparty) — carried neither: it dropped the `Round 1 · Aspect n of 5` band
 * and the save state entirely, so a reader arriving there had no round and no position.
 *
 * What the references actually draw, and what this suite pins:
 *
 *   bundle 10 (`assessment.html`)        the position sentence, the segmented bar, and the chip
 *   bundle rc1.3 (`01-answer-screen-paused-1223/js/proto.js`) the chip as a **badge with an
 *                                        icon** in four states — `Saves as You Go` (floppy),
 *                                        `Saving…` (spinner), `Saved` (check), `Not Saved · Pick
 *                                        Again` (undo) — which is the open delta on #1173 ("chips
 *                                        are words with no icon")
 *
 * The sealed band is the same band at the sheet's own position: every Aspect answered, so every
 * segment is done and the state word is `Sealed`, which is true of a sheet that takes no more
 * answers. A chip reading `Saves as You Go` over a sealed sheet would be the silent-success bug
 * arriving through copy.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnswerSheet } from "@/components/assessment-flow/answer-sheet";
import { SCORE_MAX, SCORE_MIN } from "@/content/record";
import { assessmentAnswerPageCopy } from "@/data/pages/assessment-answer";
import type { AnswerGate } from "@/lib/flow/answer-gate";
import { positionOf } from "@/lib/flow/answer-position";
import type { FlowAspect } from "@/lib/flow/screen";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const INSTANCE_ID = "session-answer-save-state-test";

/** Five answered Aspects: the sealed sheet's own state. */
const ANSWERED: readonly FlowAspect[] = Array.from({ length: 5 }, (_, index) => ({
  itemId: `aspect-${index + 1}`,
  prompt: `Aspect ${index + 1}`,
  leftValue: "Apart",
  rightValue: "Together",
  min: SCORE_MIN,
  max: SCORE_MAX,
  own: { feel: 3, wish: 4 },
}));

const SHEET: AnswerGate = {
  state: "sheet",
  role: "counterparty",
  action: `/assessment/instances/${INSTANCE_ID}/answers`,
  answered: 0,
  aspects: ANSWERED.length,
};

const SEALED: AnswerGate = {
  state: "readonly",
  role: "initiator",
  action: null,
  answered: ANSWERED.length,
  aspects: ANSWERED.length,
};

function render(gate: AnswerGate, aspects: readonly FlowAspect[] = ANSWERED): string {
  return renderToStaticMarkup(
    createElement(AnswerSheet, {
      copy: assessmentAnswerPageCopy,
      aspects,
      gate,
      viewer: { role: gate.role ?? "initiator", name: "Avery" },
      mode: "basic",
      backHref: `/assessment/instances/${INSTANCE_ID}`,
      sheetPath: `/assessment/instances/${INSTANCE_ID}/answer`,
      draftAction: `/assessment/instances/${INSTANCE_ID}/answers/draft`,
      answersAction: `/assessment/instances/${INSTANCE_ID}/answers`,
      otherName: "Rowan",
      position: positionOf(aspects, undefined),
    }),
  );
}

function count(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

/** The opening tag of the element that carries `data-saved-state`, whatever order React wrote. */
function chipTag(html: string): string {
  const found = html.match(/<span[^>]*data-saved-state="[a-z]+"[^>]*>/);
  if (!found) throw new Error("no element carries data-saved-state");
  return found[0];
}

describe("the save state is the reference's badge, not bare text", () => {
  it("draws the idle chip as a badge carrying an icon and the reference's words", () => {
    const html = render(SHEET);
    const tag = chipTag(html);
    expect(tag, "the chip is a pill").toContain("rounded-full");
    expect(tag, "the chip is a bordered chip, not a bare paragraph").toContain("border-line");
    // The icon is what #1173 names: a chip is a word *and* a mark.
    const chip = html.slice(html.indexOf(tag), html.indexOf(tag) + 900);
    expect(chip).toContain("<svg");
    expect(chip).toContain("Saves as You Go");
    expect(html).not.toContain(">Saves as you go<");
  });

  it("names every state in the reference's words", () => {
    const progress = sectionOf(assessmentAnswerPageCopy, "progress");
    expect(itemLabel(progress, "saved")).toBe("Saved");
    expect(itemLabel(progress, "saving")).toBe("Saves as You Go");
    expect(itemLabel(progress, "saving-now")).toBe("Saving…");
    expect(itemLabel(progress, "save-failed")).toBe("Not Saved · Pick Again");
  });
});

describe("the sealed sheet carries the round band it used to drop", () => {
  it("draws the position sentence at the sheet's own position", () => {
    const html = render(SEALED);
    expect(html).toContain("Round 1 · 5 of 5 Aspects answered");
  });

  it("draws one segment per Aspect, every one of them done", () => {
    const html = render(SEALED);
    expect(count(html, "data-qbar=")).toBe(ANSWERED.length);
    expect(count(html, 'data-state="done"')).toBe(ANSWERED.length);
  });

  it("names the save state as sealed, and offers no save it could not perform", () => {
    const html = render(SEALED);
    expect(html).toContain('data-saved-state="sealed"');
    expect(chipTag(html)).toContain("rounded-full");
    expect(html).toContain("Sealed");
    // The sealed sheet is not a place that saves.
    expect(html).not.toContain(">Saves as You Go<");
  });
});
