// @vitest-environment jsdom
/**
 * The v2 answer screen resumes where the reader left off (#1128).
 *
 * The card's acceptance line is `answer 2 of 5, reload, resume at 3`, and this suite walks that
 * sentence through the real chain rather than asserting it about a helper:
 *
 *   the write   two Aspects' picks, exactly as the draft endpoint receives them
 *               (`answersFrom()` → `parseDraft()`), become the `opinion` rows a reload would read
 *   the read    `projectScreen()` turns those rows into the viewer's own `aspects[].own`
 *   the screen  `positionOf()` resolves `?aspect=` (absent here, so: the first unanswered) and
 *               `AnswerSheet` renders **one** Aspect — the third — with `Aspect 3 of 5`
 *
 * The rest of the suite pins the surface's rules the issue names: one Aspect at a time, the
 * painted 1–5 band with both poles, `Next Aspect` blocked while the card is half-answered, the
 * review's per-Aspect rows and `Change` links, the blind rule at the projection (the other party's
 * rows never become prefills), and the sealed sheet stating who the reader is waiting on.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnswerSheet } from "@/components/assessment-flow/answer-sheet";
import type { Assessment } from "@/content/assessment";
import { SCORE_MAX, SCORE_MIN } from "@/content/record";
import { assessmentAnswerPageCopy } from "@/data/pages/assessment-answer";
import { assessments } from "@/data/assessments";
import type { ItemRow, OpinionRow, PartyRow } from "@/lib/db/rows";
import { answersFrom } from "@/lib/flow/answers";
import { advanceOf, answeredCount, positionOf, resumeIndexOf } from "@/lib/flow/answer-position";
import { answerGateOf, type AnswerGate } from "@/lib/flow/answer-gate";
import { answerDraftsPath, answerSheetPath, answersPath } from "@/lib/flow/paths";
import { projectScreen, type FlowSessionRows } from "@/lib/flow/screen";
import { parseDraft } from "@/lib/flow/state";

const template: Assessment = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("the test's template fixture is missing");
  return found;
})();

const INSTANCE_ID = "session-answer-resume-test";

const items: ItemRow[] = template.items.map((item, position) => ({
  record_id: INSTANCE_ID,
  item_id: item.id,
  position,
  prompt: item.prompt,
  scale_kind: "score",
  left_value: item.leftValue,
  right_value: item.rightValue,
}));

const parties: PartyRow[] = [
  { session_record_id: INSTANCE_ID, role: "initiator", name: "Avery" },
  { session_record_id: INSTANCE_ID, role: "counterparty", name: "Rowan" },
];

/** A form post, as the browser would build it — one `kind:itemId` field per pick. */
function post(picks: Readonly<Record<string, { feel: number; wish: number }>>): FormData {
  const form = new FormData();
  for (const [itemId, scores] of Object.entries(picks)) {
    form.set(`feel:${itemId}`, String(scores.feel));
    form.set(`wish:${itemId}`, String(scores.wish));
  }
  return form;
}

/** The rows a draft write leaves behind, read back as the `opinion` rows a reload would see. */
function rowsAfter(picks: Readonly<Record<string, { feel: number; wish: number }>>): OpinionRow[] {
  const parsed = answersFrom(post(picks), ["feel", "wish"]);
  return parseDraft(
    items.map((item) => item.item_id),
    parsed.answers,
    "basic",
  ).map((answer) => ({
    session_record_id: INSTANCE_ID,
    role: "initiator",
    item_id: answer.itemId,
    feel: answer.opinions.feel,
    wish: answer.opinions.wish,
    think: null,
    guess: null,
  }));
}

function screenWith(opinions: readonly OpinionRow[]) {
  const rows: FlowSessionRows = {
    record: {
      id: INSTANCE_ID,
      slug: "answer-resume-test",
      record_type: "assessment",
      status: "draft",
      date: new Date("2026-11-01T12:00:00.000Z"),
      title: template.title,
      summary: "a session under test",
    },
    items,
    options: [],
    session: {
      record_id: INSTANCE_ID,
      template_record_id: template.id,
      relationship_id: "relationship-test",
      mode: "basic",
      setting: "soft",
    },
    parties,
    opinions: [...opinions],
    answerCounts: {
      initiator: opinions.filter((opinion) => opinion.role === "initiator").length,
      counterparty: 0,
    },
  };
  return projectScreen({ rows, template, viewerRole: "initiator", invite: null });
}

function renderSheet({
  screen,
  gate,
  aspect,
  otherName = "Rowan",
  resultsReady = false,
}: {
  screen: ReturnType<typeof screenWith>;
  gate: AnswerGate;
  aspect?: string;
  otherName?: string;
  resultsReady?: boolean;
}): string {
  return renderToStaticMarkup(
    createElement(AnswerSheet, {
      copy: assessmentAnswerPageCopy,
      aspects: screen.aspects,
      gate,
      viewer: screen.viewer,
      mode: screen.mode,
      backHref: `/assessment/instances/${INSTANCE_ID}`,
      sheetPath: answerSheetPath(INSTANCE_ID),
      draftAction: answerDraftsPath(INSTANCE_ID),
      answersAction: answersPath(INSTANCE_ID),
      otherName,
      position: positionOf(screen.aspects, aspect),
      resultsReady,
    }),
  );
}

function gateFor(screen: ReturnType<typeof screenWith>, accepted = false): AnswerGate {
  return answerGateOf({
    sessionRecordId: screen.sessionRecordId,
    viewerRole: "initiator",
    status: screen.status,
    viewerAccepted: accepted,
    aspects: screen.aspects,
  });
}

/** The two Aspects the test answers, and the three it does not. */
const ANSWERED = {
  [items[0].item_id]: { feel: 2, wish: 5 },
  [items[1].item_id]: { feel: 4, wish: 4 },
};

/** The checked values in one radio group, by wire name. */
function checkedIn(html: string, name: string): string[] {
  const found: string[] = [];
  for (const match of html.matchAll(/<input\b[^>]*>/g)) {
    const tag = match[0];
    if (!/type="radio"/.test(tag)) continue;
    if (!/checked=""/.test(tag)) continue;
    if (new RegExp(`name="${name}"`).test(tag)) {
      found.push(/value="([^"]*)"/.exec(tag)?.[1] ?? "");
    }
  }
  return found;
}

describe("save and resume: answer 2 of 5, reload, resume at 3", () => {
  const screen = screenWith(rowsAfter(ANSWERED));

  it("writes the two answered Aspects and leaves the rest alone", () => {
    const rows = rowsAfter(ANSWERED);
    expect(rows.map((row) => row.item_id)).toEqual([items[0].item_id, items[1].item_id]);
    // The picks round-trip: no default, no re-ordering, no third row invented.
    expect(rows[0]).toMatchObject({ feel: 2, wish: 5, think: null, guess: null });
  });

  it("counts what the read gives back, from the viewer's own rows only", () => {
    expect(answeredCount(screen.aspects)).toBe(2);
    expect(screen.aspects.map((aspect) => aspect.own === null)).toEqual([
      false,
      false,
      true,
      true,
      true,
    ]);
  });

  it("resumes at the first unanswered Aspect", () => {
    expect(resumeIndexOf(screen.aspects)).toBe(3);
    expect(positionOf(screen.aspects, undefined)).toEqual({
      index: 3,
      total: items.length,
      review: false,
    });
  });

  it("draws that one Aspect, and says where the reader is", () => {
    const html = renderSheet({ screen, gate: gateFor(screen) });
    expect(html).toContain("Aspect 3 of 5");
    expect(html).toContain(items[2].prompt);
  });

  it("draws one Aspect per screen — never the ones already answered", () => {
    const html = renderSheet({ screen, gate: gateFor(screen) });
    expect(html).not.toContain(items[0].prompt);
    expect(html).not.toContain(items[1].prompt);
    // One card, so one eyebrow and one painted band per kind it asks.
    expect(html.split("data-aspect-card=").length - 1).toBe(1);
  });

  it("addresses the position, so Back and Change land on a card rather than a blank", () => {
    expect(positionOf(screen.aspects, "2").index).toBe(2);
    expect(positionOf(screen.aspects, "review").review).toBe(true);
    // A position this sheet does not have falls back to the resume point.
    expect(positionOf(screen.aspects, "99").index).toBe(3);
    expect(positionOf(screen.aspects, "nonsense").index).toBe(3);
    const html = renderSheet({ screen, gate: gateFor(screen), aspect: "review" });
    expect(html).toContain("Check Your Answers");
  });
});

describe("the card draws the locked 1–5 scale, once per kind", () => {
  const screen = screenWith(rowsAfter(ANSWERED));
  const html = renderSheet({ screen, gate: gateFor(screen) });

  it("paints all five cells of the bundle's scale, numbered", () => {
    for (const notch of [1, 2, 3, 4, 5]) {
      expect(html).toContain(`bg-scale-${notch}`);
      expect(html).toContain(`data-notch="${notch}"`);
    }
    expect(SCORE_MIN).toBe(1);
    expect(SCORE_MAX).toBe(5);
  });

  it("prints both poles under the band, with their numbers", () => {
    expect(html).toContain(`1 · ${items[2].left_value}`);
    expect(html).toContain(`5 · ${items[2].right_value}`);
  });

  it("posts the Aspect's own position fields, and no seat", () => {
    expect(html).toContain(`name="item" value="${items[2].item_id}"`);
    expect(html).toContain('name="aspect" value="3"');
    expect(html).not.toMatch(/\bname="role"/);
    // The draft endpoint, not the seal: save-as-you-go is a partial write.
    expect(html).toContain(`action="${answerDraftsPath(INSTANCE_ID)}"`);
  });

  it("asks Feel and Wish, and blocks the way forward until both are picked", () => {
    expect(html).toContain(`name="feel:${items[2].item_id}"`);
    expect(html).toContain(`name="wish:${items[2].item_id}"`);
    expect(html).not.toContain(`name="think:${items[2].item_id}"`);
    // Nothing is picked on this Aspect, so the primary button is disabled and the hint is drawn.
    expect(html).toMatch(/value="next"[^>]*disabled/);
    expect(html).toContain("Pick a number for Feel and for Wish to continue.");
  });

  it("prefills nothing but the viewer's own stored scores", () => {
    const aspect = screen.aspects[0];
    expect(aspect.own).toEqual({ feel: 2, wish: 5 });
    const first = renderSheet({ screen, gate: gateFor(screen), aspect: "1" });
    expect(checkedIn(first, `feel:${aspect.itemId}`)).toEqual(["2"]);
    expect(checkedIn(first, `wish:${aspect.itemId}`)).toEqual(["5"]);
  });
});

describe("the review", () => {
  const screen = screenWith(rowsAfter(ANSWERED));

  it("lists every Aspect with its scores and a Change link to that card", () => {
    const html = renderSheet({ screen, gate: gateFor(screen), aspect: "review" });
    expect(html).toContain("Check Your Answers");
    expect(html).toContain("Once you submit, your answers are sealed for Round 1.");
    for (const [index, item] of items.entries()) {
      expect(html).toContain(`data-review-row="${item.item_id}"`);
      expect(html).toContain(`?aspect=${index + 1}"`);
    }
    expect(html).toContain("Feel 2 · Wish 5");
  });

  it("carries the whole sheet to the seal, and refuses to submit a partial one", () => {
    const html = renderSheet({ screen, gate: gateFor(screen), aspect: "review" });
    expect(html).toContain(`action="${answersPath(INSTANCE_ID)}"`);
    // Two Aspects answered, three not: the seal's button is disabled rather than refused later.
    expect(html).toContain("data-review-submit");
    expect(html).toContain('disabled=""');

    const complete = rowsAfter(everyAspect());
    const whole = renderSheet({
      screen: screenWith(complete),
      gate: gateFor(screenWith(complete)),
      aspect: "review",
    });
    expect(whole).toContain("data-review-submit");
    expect(whole).not.toContain('disabled=""');
  });
});

/** Every Aspect answered — the sheet a party reviews before the seal. */
function everyAspect(): Record<string, { feel: number; wish: number }> {
  return Object.fromEntries(items.map((item) => [item.item_id, { feel: 3, wish: 4 }]));
}

describe("the blind rule holds at the projection", () => {
  it("never turns the other party's rows into a prefill or a count", () => {
    const theirs: OpinionRow[] = items.map((item) => ({
      session_record_id: INSTANCE_ID,
      role: "counterparty",
      item_id: item.item_id,
      feel: 5,
      wish: 5,
      think: null,
      guess: null,
    }));
    const screen = screenWith(theirs);
    for (const aspect of screen.aspects) expect(aspect.own).toBeNull();
    expect(answeredCount(screen.aspects)).toBe(0);
    const html = renderSheet({ screen, gate: gateFor(screen) });
    expect(html).not.toMatch(/checked=""/);
  });
});

describe("the sealed sheet says what happens next", () => {
  const screen = screenWith(rowsAfter(everyAspect()));

  it("names who the reader is waiting on, and offers no control", () => {
    const html = renderSheet({
      screen,
      gate: gateFor(screen, true),
      resultsReady: false,
    });
    expect(html).toContain('data-frozen-status="waiting"');
    expect(html).toContain("Waiting for Rowan");
    expect(html).not.toContain("data-review-submit");
    expect(html).not.toContain('value="next"');
    expect(html).not.toContain('value="reset"');
  });

  it("says the results are ready once both have finished", () => {
    const html = renderSheet({ screen, gate: gateFor(screen, true), resultsReady: true });
    expect(html).toContain('data-frozen-status="ready"');
    expect(html).toContain("Results are ready");
  });
});

describe("advancing", () => {
  it("blocks on a half-answered card, and reviews past the last Aspect", () => {
    const answered = Array.from({ length: 5 }, () => ({
      own: { feel: 1 as const, wish: 1 as const },
    }));
    const position = positionOf(answered, "3");
    expect(position.index).toBe(3);
    expect(advanceOf({ index: 3, total: 5, review: false }, false)).toEqual({ kind: "blocked" });
    expect(advanceOf({ index: 3, total: 5, review: false }, true)).toEqual({
      kind: "aspect",
      index: 4,
    });
    expect(advanceOf({ index: 5, total: 5, review: false }, true)).toEqual({ kind: "review" });
    expect(advanceOf({ index: 5, total: 5, review: true }, true)).toEqual({ kind: "review" });
  });
});
