/**
 * The answer sheet on a lapsed relationship (#848, and the state #1223 makes reachable).
 *
 * Two rules meet on this screen and neither may eat the other:
 *
 *   #848 — a lapsed trial closes the **Gap**, not the pairing. The owner's decision was that the
 *          seven days ending does not also end the two people's session, so the sheet stays
 *          writable and only `screen.report` stays shut. Before that change the sheet went
 *          read-only on a lapse, and a counterparty who opened the link on day eight could not
 *          answer at all.
 *   #1223 — `lapsed` is a surface of its own. It sat in `ANSWER_SHEET_STATES` since #533 phase 3
 *          with no branch returning it, so the paused pane could never render; the gate returns it
 *          now, and it outranks every other state except `coach`.
 *
 * The shape that satisfies both: `state === "lapsed"` says which pane the page draws, and `action`
 * is still the same `maySubmit()` the `sheet` branch asks — so a lapse names the pause without
 * taking the form away, and an accepted seat still has none.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnswerSheet } from "@/components/assessment-flow/answer-sheet";
import { SCORE_MAX, SCORE_MIN } from "@/content/record";
import { assessmentAnswerPageCopy } from "@/data/pages/assessment-answer";
import { answerGateOf, type AnswerGate } from "@/lib/flow/answer-gate";
import { positionOf } from "@/lib/flow/answer-position";
import type { FlowAspect } from "@/lib/flow/screen";
import type { Membership } from "@/lib/relationship/membership";

const SESSION_ID = "c8832c24-5196-4ebe-aaa6-2e89a9e04720";
const ANSWERS = `/assessment/instances/${SESSION_ID}/answers`;

/** A lapsed trial: the subscription that paid for the relationship ended. */
const LAPSED: Membership = {
  state: "lapsed",
  reason: "trial-ended",
  endedAt: new Date("2026-11-19T06:53:18.504Z"),
  writable: false,
};

const ASPECTS: readonly FlowAspect[] = [
  {
    itemId: "aspect-time-together",
    prompt: "Time together",
    leftValue: "Apart",
    rightValue: "Together",
    min: SCORE_MIN,
    max: SCORE_MAX,
    own: { feel: 2, wish: 4 },
  },
  {
    itemId: "aspect-money",
    prompt: "Money",
    leftValue: "Apart",
    rightValue: "Together",
    min: SCORE_MIN,
    max: SCORE_MAX,
    own: null,
  },
];

function gate(overrides: Partial<Parameters<typeof answerGateOf>[0]> = {}): AnswerGate {
  return answerGateOf({
    sessionRecordId: SESSION_ID,
    status: "answering",
    viewerRole: "counterparty",
    viewerAccepted: false,
    aspects: ASPECTS,
    membership: LAPSED,
    ...overrides,
  });
}

/** The sheet as a browser receives it. */
function render(drawn: AnswerGate, role: "initiator" | "counterparty" = "counterparty"): string {
  return renderToStaticMarkup(
    createElement(AnswerSheet, {
      copy: assessmentAnswerPageCopy,
      aspects: ASPECTS,
      gate: drawn,
      viewer: { role, name: "Rowan" },
      mode: "basic",
      backHref: `/assessment/instances/${SESSION_ID}`,
      sheetPath: `/assessment/instances/${SESSION_ID}/answer`,
      draftAction: `/assessment/instances/${SESSION_ID}/answers/draft`,
      answersAction: drawn.action ?? ANSWERS,
      otherName: "Avery",
      position: positionOf(ASPECTS, undefined),
    }),
  );
}

/** The rendered text, tags dropped — a class name is not a word a reader sees. */
function visibleText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");
}

describe("the gate on a lapsed relationship", () => {
  it("returns `lapsed` for a lapsed membership and a counterparty — the state that was unreachable", () => {
    const drawn = gate();
    expect(drawn.state).toBe("lapsed");
    expect(drawn.role).toBe("counterparty");
  });

  it("returns it for the Initiator too, not only the invited party", () => {
    expect(gate({ viewerRole: "initiator" }).state).toBe("lapsed");
  });

  it("carries the same counts and role the other branches return", () => {
    const drawn = gate();
    expect(drawn.answered).toBe(1);
    expect(drawn.aspects).toBe(2);
    expect(gate({ viewerRole: "initiator" }).role).toBe("initiator");
  });

  /**
   * The #848 half of the rule, stated as a fact about `maySubmit()`: the lapse changes which pane
   * is drawn and nothing about who may write. This viewer may submit, so the action is here.
   */
  it("keeps maySubmit() unchanged: a viewer who may submit still gets the action", () => {
    expect(gate().action).toBe(ANSWERS);
    expect(gate({ viewerRole: "initiator" }).action).toBe(ANSWERS);
  });

  it("still takes the form away once this viewer has accepted — maySubmit() is not made laxer", () => {
    const frozen = gate({ viewerAccepted: true });
    expect(frozen.state).toBe("lapsed");
    expect(frozen.action).toBeNull();
  });

  it("never outranks the coach band: a coach has no seat to lose", () => {
    const coach = gate({ viewerRole: "coach" });
    expect(coach.state).toBe("coach");
    expect(coach.role).toBeNull();
    expect(coach.action).toBeNull();
  });

  it("leaves a relationship with no membership reading on the sheet", () => {
    expect(gate({ membership: undefined }).state).toBe("sheet");
    expect(gate({ membership: null }).state).toBe("sheet");
  });
});

describe("the paused pane on a lapsed relationship", () => {
  it("draws the status pane above a sheet that is still a form", () => {
    const html = render(gate());
    expect(html).toContain('data-paused=""');
    expect(html).toContain("Answering Is Paused For Now");
    expect(html).toContain("You’ll hear when it resumes. Your answers are saved.");
    // The form the lapse used to take away is still here, posting where it always posted.
    expect(html).toContain(`action="/assessment/instances/${SESSION_ID}/answers/draft"`);
    expect(html).toContain('method="post"');
    expect(html).toContain('type="radio"');
  });

  it("draws the Initiator's own sentence, and tells them whose membership it is", () => {
    const html = render(gate({ viewerRole: "initiator" }), "initiator");
    expect(html).toContain("Answering Is Paused");
    expect(html).not.toContain("Answering Is Paused For Now");
    expect(html).toContain("This relationship is still paused. Your answers are saved.");
    expect(visibleText(html)).toContain("This is the initiator's membership, not yours");
  });

  /**
   * The locked rule for this page: the Counterparty never reads a price, a trial, a card, a
   * payment, a plan or a membership word. The pane and the record below it are the two places a
   * billing sentence could have leaked, so both are searched.
   */
  it("shows the Counterparty no billing word at all", () => {
    const text = visibleText(render(gate())).toLowerCase();
    for (const word of ["membership", "payment", "trial", "card", "plan", "price", "$"]) {
      expect(text, `the Counterparty's page reads “${word}”`).not.toContain(word);
    }
  });

  it("a lapsed sheet the viewer has accepted is the record, with the pane and no form", () => {
    const html = render(gate({ viewerAccepted: true }));
    expect(html).toContain('data-paused=""');
    expect(html).not.toContain("<form");
    expect(html).not.toContain('type="radio"');
    expect(html).toContain('data-frozen-status="waiting"');
  });

  it("a live sheet on an open relationship draws no paused pane", () => {
    const html = render(
      gate({ membership: { state: "open", reason: null, endedAt: null, writable: true } }),
    );
    expect(html).not.toContain('data-paused=""');
    expect(html).toContain('type="radio"');
  });

  it("replaces the row's amber treatment with the status tokens", () => {
    const html = render(gate());
    expect(html).toContain("border-status-line");
    expect(html).toContain("bg-status-chip");
    expect(html).not.toMatch(/\bamber-/);
  });
});
