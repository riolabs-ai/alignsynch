/**
 * The answer sheet's gate, and the sheet it gates (#427, R2-2).
 *
 * Two halves, both without a database:
 *
 *   the decision   `answerGateOf()` over a projected screen — the three states, the action only
 *                  the writable one carries, and the prefilled count. A coach has no seat and no
 *                  action; a complete session is read-only; an answering seat gets the endpoint.
 *   the markup     `AnswerSheet` rendered to static markup, read the way a browser would read it:
 *                  the form posts to `/answers` with `kind:itemId` fields, only the viewer's own
 *                  scores are checked, no field names a seat, and the coach and sealed states
 *                  render **no `<form>` at all** — a fact, not a disabled control.
 *
 * The blind rule is pinned twice: the projection never turns the counterparty's rows into a
 * prefill (`projectScreen()` reads `own` by the viewer's role), and the rendered page carries no
 * checked score the viewer did not give. The live proof — grepping the counterparty's stored values
 * out of the served HTML — is in the card's acceptance, because only Postgres can prove which rows
 * the query asked for.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnswerSheet } from "@/components/assessment-flow/answer-sheet";
import type { Opinions, PartyRole } from "@/content/assessment";
import type { Assessment } from "@/content/assessment";
import { SCORE_MAX, SCORE_MIN } from "@/content/record";
import { assessmentAnswerPageCopy } from "@/data/pages/assessment-answer";
import { assessments } from "@/data/assessments";
import type { ItemRow, OpinionRow, PartyRow } from "@/lib/db/rows";
import { answerGateOf, ownScoreOf, type AnswerGate } from "@/lib/flow/answer-gate";
import { projectScreen, type FlowAspect, type FlowInstanceRows } from "@/lib/flow/screen";

const template: Assessment = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("the test's template fixture is missing");
  return found;
})();

const INSTANCE_ID = "instance-answer-gate-test";
const TIME = "aspect-time-together";

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

/** The same two seats, with an instant on the ones a test says have accepted. */
function partiesWith(accepted: readonly PartyRole[]): PartyRow[] {
  return parties.map((party) => ({
    ...party,
    accepted_at: accepted.includes(party.role as PartyRole) ? ACCEPTED_AT : null,
  }));
}

/** A fixed acceptance instant, so a test never reads a clock. */
const ACCEPTED_AT = "2026-11-01T12:00:00.000Z";

/** One Aspect's answers, as a row: `own` is whoever the projection was asked for. */
function opinion(role: PartyRole, itemId: string, feel: number, wish: number): OpinionRow {
  return {
    session_record_id: INSTANCE_ID,
    role,
    item_id: itemId,
    feel,
    wish,
    think: null,
    guess: null,
  };
}

function rowsWith(
  opinions: readonly OpinionRow[],
  accepted: readonly PartyRole[] = [],
): FlowInstanceRows {
  const count = (role: PartyRole) => opinions.filter((entry) => entry.role === role).length;
  return {
    record: {
      id: INSTANCE_ID,
      slug: "answer-gate-test",
      record_type: "assessment",
      status: "draft",
      date: new Date("2026-11-01T12:00:00.000Z"),
      title: template.title,
      summary: "an instance under test",
    },
    items,
    options: [],
    instance: {
      record_id: INSTANCE_ID,
      template_record_id: template.id,
      relationship_id: "relationship-test",
      mode: "basic",
      setting: "soft",
    },
    parties: partiesWith(accepted),
    opinions: [...opinions],
    answerCounts: { initiator: count("initiator"), counterparty: count("counterparty") },
  };
}

/** A projected screen for one viewer, over the rows a read path would have handed it. */
function screenFor(
  role: PartyRole | "coach",
  opinions: readonly OpinionRow[] = [],
  accepted: readonly PartyRole[] = [],
) {
  return projectScreen({
    rows: rowsWith(opinions, accepted),
    template,
    viewerRole: role,
    invite: null,
  });
}

/** The gate for a screen, the way the page derives it. */
function gateFor(
  role: PartyRole | "coach",
  opinions: readonly OpinionRow[] = [],
  accepted: readonly PartyRole[] = [],
): AnswerGate {
  const screen = screenFor(role, opinions, accepted);
  return answerGateOf({
    instanceRecordId: screen.instanceRecordId,
    viewerRole: screen.viewer.role,
    status: screen.status,
    viewerAccepted: screen.viewerAccepted,
    aspects: screen.aspects,
  });
}

/** One Aspect as the sheet receives it, with whatever the viewer already answered. */
function aspectWith(itemId: string, own: Opinions | null): FlowAspect {
  const item = items.find((entry) => entry.item_id === itemId);
  if (item === undefined) throw new Error(`no item ${itemId}`);
  return {
    itemId,
    prompt: item.prompt,
    leftValue: item.left_value ?? "",
    rightValue: item.right_value ?? "",
    min: SCORE_MIN,
    max: SCORE_MAX,
    own,
  };
}

/** The sheet as a browser receives it. */
function render(
  gate: AnswerGate,
  aspects: readonly FlowAspect[],
  viewer: { role: PartyRole | "coach"; name: string } = { role: "initiator", name: "Avery" },
): string {
  return renderToStaticMarkup(
    createElement(AnswerSheet, {
      copy: assessmentAnswerPageCopy,
      aspects,
      gate,
      viewer,
      mode: "basic",
      backHref: `/assessment/instances/${INSTANCE_ID}`,
    }),
  );
}

/** Every radio in the markup, with the wire name and value the POST would carry. */
function radios(html: string): { name: string; value: string; checked: boolean }[] {
  const found: { name: string; value: string; checked: boolean }[] = [];
  for (const match of html.matchAll(/<input\b[^>]*>/g)) {
    const tag = match[0];
    const name = /\bname="([^"]*)"/.exec(tag)?.[1];
    const value = /\bvalue="([^"]*)"/.exec(tag)?.[1];
    if (name === undefined || value === undefined) continue;
    if (!/\btype="radio"/.test(tag)) continue;
    found.push({ name, value, checked: /\bchecked\b/.test(tag) });
  }
  return found;
}

/** The checked values in one radio group, by wire name. */
function checkedIn(html: string, name: string): string[] {
  return radios(html)
    .filter((radio) => radio.name === name && radio.checked)
    .map((radio) => radio.value);
}

describe("answerGateOf: which surface the page draws", () => {
  it("gives the seat that may answer a form action at the answers endpoint", () => {
    const gate = gateFor("initiator");
    expect(gate.state).toBe("sheet");
    expect(gate.role).toBe("initiator");
    expect(gate.action).toBe(`/assessment/instances/${INSTANCE_ID}/answers`);
    expect(gate.aspects).toBe(items.length);
    expect(gate.answered).toBe(0);
  });

  it("resolves the counterparty as them, not as the initiator", () => {
    const gate = gateFor("counterparty");
    expect(gate.state).toBe("sheet");
    expect(gate.role).toBe("counterparty");
  });

  it("counts only the viewer's own answers as prefilled", () => {
    const gate = gateFor("initiator", [opinion("initiator", TIME, 4, 2)]);
    expect(gate.answered).toBe(1);
    const other = gateFor("counterparty", [opinion("initiator", TIME, 4, 2)]);
    expect(other.answered).toBe(0);
  });

  it("a coach has no seat and no action", () => {
    const gate = gateFor("coach");
    expect(gate.state).toBe("coach");
    expect(gate.role).toBeNull();
    expect(gate.action).toBeNull();
  });

  it("a sealed session is read-only, not a form that can only be refused", () => {
    const every = items.flatMap((item) => [
      opinion("initiator", item.item_id, 1, 1),
      opinion("counterparty", item.item_id, 5, 5),
    ]);
    const gate = gateFor("initiator", every, ["initiator", "counterparty"]);
    expect(gate.state).toBe("readonly");
    expect(gate.role).toBe("initiator");
    expect(gate.action).toBeNull();
    expect(gate.answered).toBe(items.length);
  });

  /**
   * The freeze is per party (#R2), and this is the half of it a status cannot say. Both parties
   * are still answering; the initiator has accepted, so their sheet is the record they agreed to
   * and the counterparty's is still theirs to edit — the same session, two different answers to
   * "may this viewer write".
   */
  it("locks the seat that accepted while the other seat may still answer", () => {
    const partial = items.map((item) => opinion("initiator", item.item_id, 3, 3));
    const sealed = gateFor("initiator", partial, ["initiator"]);
    expect(sealed.state).toBe("readonly");
    expect(sealed.action).toBeNull();

    const other = gateFor("counterparty", partial, ["initiator"]);
    expect(other.state).toBe("sheet");
    expect(other.action).toBe(`/assessment/instances/${INSTANCE_ID}/answers`);
  });
});

describe("the sheet's markup", () => {
  const aspects = items.map((item) => aspectWith(item.item_id, null));

  it("is a plain POST to the instance's answers endpoint", () => {
    const html = render(gateFor("initiator"), aspects);
    expect(html).toContain(`action="/assessment/instances/${INSTANCE_ID}/answers"`);
    expect(html).toContain('method="post"');
  });

  it("names no seat, and carries no hidden field of any kind", () => {
    const html = render(gateFor("initiator"), aspects);
    expect(html).not.toMatch(/\bname="role"/);
    expect(html).not.toMatch(/type="hidden"/);
    // The seat is drawn for the reader, from the read that resolved it.
    expect(html).toContain('data-answering-as="initiator"');
  });

  it("posts kind:itemId with the whole 1..5 band on every Aspect", () => {
    const html = render(gateFor("initiator"), aspects);
    const found = radios(html);
    expect(found).toHaveLength(items.length * 2 * (SCORE_MAX - SCORE_MIN + 1));
    for (const item of items) {
      for (const kind of ["feel", "wish"]) {
        const values = found
          .filter((radio) => radio.name === `${kind}:${item.item_id}`)
          .map((radio) => radio.value);
        expect(values, `${kind}:${item.item_id}`).toEqual(["1", "2", "3", "4", "5"]);
      }
    }
  });

  it("asks only the kinds a Basic Mode instance defines", () => {
    const html = render(gateFor("initiator"), aspects);
    expect(html).toContain(`name="feel:${TIME}"`);
    expect(html).toContain(`name="wish:${TIME}"`);
    expect(html).not.toContain(`name="think:${TIME}"`);
    expect(html).not.toContain(`name="guess:${TIME}"`);
  });

  it("checks the viewer's own stored answers and nothing else", () => {
    const answered = items.map((item) =>
      aspectWith(item.item_id, item.item_id === TIME ? { feel: 4, wish: 2 } : null),
    );
    const html = render(gateFor("initiator", [opinion("initiator", TIME, 4, 2)]), answered);
    expect(checkedIn(html, `feel:${TIME}`)).toEqual(["4"]);
    expect(checkedIn(html, `wish:${TIME}`)).toEqual(["2"]);
    // The Aspect they have not answered stays blank: a default answer is one they did not give.
    const untouched = items.find((item) => item.item_id !== TIME);
    expect(checkedIn(html, `feel:${untouched?.item_id}`)).toEqual([]);
  });

  it("a coach gets the badge and no form at all", () => {
    const html = render(gateFor("coach"), aspects, { role: "coach", name: "" });
    expect(html).not.toContain("<form");
    expect(html).not.toMatch(/type="radio"/);
    expect(html).toContain('data-coach-badge="true"');
    expect(html).toContain("Coach");
  });

  it("a sealed sheet draws the viewer's own answers disabled, with no form", () => {
    const initiatorAnswers = items.map((item) => aspectWith(item.item_id, { feel: 2, wish: 4 }));
    const sealed = render(
      gateFor(
        "initiator",
        items.flatMap((item) => [
          opinion("initiator", item.item_id, 2, 4),
          opinion("counterparty", item.item_id, 5, 5),
        ]),
        ["initiator", "counterparty"],
      ),
      initiatorAnswers,
    );
    expect(sealed).not.toContain("<form");
    expect(sealed).toContain("<fieldset disabled");
    expect(checkedIn(sealed, `feel:${TIME}`)).toEqual(["2"]);
    expect(checkedIn(sealed, `wish:${TIME}`)).toEqual(["4"]);
  });
});

describe("the blind rule, at the projection", () => {
  /**
   * The counterparty answered 5/5 on every Aspect and the viewer answered nothing. Their rows are
   * handed to the projection — which is what a read path *would* do only once the session is
   * complete — and the viewer's sheet must still carry no score: `own` is read by the viewer's
   * role, so another seat's row cannot become a prefill.
   */
  it("never turns another seat's rows into prefills", () => {
    const theirs = items.map((item) => opinion("counterparty", item.item_id, SCORE_MAX, SCORE_MAX));
    const screen = screenFor("initiator", theirs);
    for (const aspect of screen.aspects) expect(aspect.own).toBeNull();

    const html = render(gateFor("initiator", theirs), screen.aspects);
    expect(radios(html).filter((radio) => radio.checked)).toHaveLength(0);
  });

  it("keeps a Basic Aspect's Think and Guess out of the prefilled read", () => {
    const aspect = aspectWith(TIME, { feel: 2, wish: 3 });
    expect(ownScoreOf(aspect, "feel")).toBe(2);
    expect(ownScoreOf(aspect, "think")).toBeUndefined();
  });
});
