// @vitest-environment jsdom
/**
 * The answer input is a five-segment radio group, not a slider (#273).
 *
 * The decision (recorded in `docs/specs/ux-input.md`) is that the control carries the whole
 * 1–5 band as five discrete, labelled choices: the stored integer is the Gap's operand, so a
 * control that cannot be set to 2 or 4 exactly is a control that corrupts the arithmetic. The
 * cases here read the **rendered** sheet — the real screen, from the real fixture — and pin
 * the claims the issue makes acceptance criteria of:
 *
 *   structure   one `<fieldset>`+`<legend>` per Aspect, one nested pair per opinion kind;
 *   count       five radios per group, values 1..5, names `kind:itemId` (the wire format);
 *   labels      the pole radios name their Value, middle ones are the numeral described by
 *               the pole line, so no digit is announced outside its band;
 *   blank       nothing is checked on an unanswered sheet — a default answer is an answer the
 *               person did not give; an answered one round-trips its own score;
 *   target      44×44 CSS px on every segment, as a class, so it is a fact about the markup;
 *   not-a-slider no `type="range"`, no slider role, no toggle-button semantics anywhere in the
 *               component, and no `"use client"` — the no-JS `POST` is the contract.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssessmentInstanceView } from "@/components/assessment-flow/instance-view";
import type { Assessment } from "@/content/assessment";
import { SCORE_MAX, SCORE_MIN } from "@/content/record";
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { assessments } from "@/data/assessments";
import type { ItemRow, OpinionRow, PartyRow } from "@/lib/db/rows";
import { projectScreen, type FlowInstanceRows } from "@/lib/flow/screen";

const template: Assessment = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("the test's template fixture is missing");
  return found;
})();

const INSTANCE_ID = "instance-answer-input-test";

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

/** One answered Aspect — Feel 4, Wish 2 — so the round-trip can be read off the rendered DOM. */
const answered: OpinionRow = {
  session_record_id: INSTANCE_ID,
  role: "initiator",
  item_id: items[0].item_id,
  feel: 4,
  wish: 2,
  think: null,
  guess: null,
};

function rowsWith(opinions: readonly OpinionRow[]): FlowInstanceRows {
  return {
    record: {
      id: INSTANCE_ID,
      slug: "answer-input-test",
      record_type: "assessment",
      status: "draft",
      date: new Date("2026-10-31T12:00:00.000Z"),
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
    parties,
    opinions: [...opinions],
    answerCounts: {
      initiator: opinions.some((opinion) => opinion.role === "initiator") ? 5 : 0,
      counterparty: 0,
    },
  };
}

/** The sheet as a browser receives it, mounted into a jsdom document for querying. */
function sheet(opinions: readonly OpinionRow[] = []): HTMLElement {
  const screen = projectScreen({
    rows: rowsWith(opinions),
    template,
    viewerRole: "initiator",
    invite: null,
  });
  const html = renderToStaticMarkup(
    createElement(AssessmentInstanceView, { screen, copy: assessmentInstancePageCopy }),
  );
  const host = document.createElement("div");
  // The component's own server-rendered output, never third-party or user input: this is how
  // the suite queries markup React produced, the same way a browser would read it.
  host.innerHTML = html;
  return host;
}

/** Every group's radios, by the name the POST will carry. */
function groups(host: HTMLElement): Map<string, HTMLInputElement[]> {
  const found = new Map<string, HTMLInputElement[]>();
  for (const radio of host.querySelectorAll<HTMLInputElement>('form input[type="radio"]')) {
    const list = found.get(radio.name) ?? [];
    list.push(radio);
    found.set(radio.name, list);
  }
  return found;
}

describe("the answer sheet's structure", () => {
  it("draws one fieldset per Aspect, its legend the prompt", () => {
    const host = sheet();
    const aspects = [...host.querySelectorAll("form > fieldset")];
    expect(aspects).toHaveLength(items.length);
    for (const [index, aspect] of aspects.entries()) {
      expect(aspect.getAttribute("data-aspect")).toBe(items[index].item_id);
      expect(aspect.querySelector(":scope > legend")?.textContent).toBe(items[index].prompt);
    }
  });

  it("nests one fieldset per opinion kind, its legend the kind's word", () => {
    const host = sheet();
    const kinds = [...host.querySelectorAll("form fieldset[data-kind]")];
    expect(kinds).toHaveLength(items.length * 2);
    for (const kind of kinds) {
      expect(["Feel", "Wish"]).toContain(kind.querySelector(":scope > legend")?.textContent);
    }
  });

  it("posts five radios per group, values 1..5, under name kind:itemId", () => {
    const host = sheet();
    const found = groups(host);
    expect(found.size).toBe(items.length * 2);
    for (const item of items) {
      for (const kind of ["feel", "wish"]) {
        const radios = found.get(`${kind}:${item.item_id}`);
        expect(radios, `${kind}:${item.item_id}`).toBeDefined();
        expect(radios?.map((radio) => radio.value)).toEqual(
          Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, index) =>
            String(index + SCORE_MIN),
          ),
        );
      }
    }
  });

  it("keeps the form a plain POST to the answers path", () => {
    const host = sheet();
    const form = host.querySelector("form");
    expect(form?.getAttribute("method")).toBe("post");
    expect(form?.getAttribute("action")).toBe(`/assessment/instances/${INSTANCE_ID}/answers`);
  });
});

describe("the accessible name of a segment", () => {
  it("carries the pole word at the ends, so a pole is not a bare digit", () => {
    const host = sheet();
    const found = groups(host);
    for (const item of items) {
      const radios = found.get(`feel:${item.item_id}`) ?? [];
      expect(radios[0].getAttribute("aria-label")).toBe(`${item.left_value} — 1`);
      expect(radios[4].getAttribute("aria-label")).toBe(`${item.right_value} — 5`);
    }
  });

  it("describes every radio with the pole line, so a middle digit has its band", () => {
    const host = sheet();
    for (const radio of host.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
      const describedBy = radio.getAttribute("aria-describedby");
      expect(describedBy).not.toBeNull();
      const poles = host.querySelector(`#${describedBy}`);
      expect(poles, `${radio.name} ${radio.value}`).not.toBeNull();
      expect(poles?.textContent).toContain("—");
    }
  });

  it("gives the middle three radios the numeral as their name", () => {
    const host = sheet();
    const radios = groups(host).get(`wish:${items[0].item_id}`) ?? [];
    expect(radios.slice(1, 4).map((radio) => radio.getAttribute("aria-label"))).toEqual([
      "2",
      "3",
      "4",
    ]);
  });
});

describe("no answer is pre-selected", () => {
  it("checks nothing on a sheet nobody has answered", () => {
    const host = sheet();
    expect(host.querySelectorAll('input[type="radio"][checked]')).toHaveLength(0);
  });

  it("marks the group required while its radios are all unchecked", () => {
    const host = sheet();
    for (const radios of groups(host).values()) {
      expect(radios.filter((radio) => radio.required)).toHaveLength(1);
      expect(radios[0].required).toBe(true);
      expect(radios.some((radio) => radio.checked)).toBe(false);
    }
  });

  it("round-trips the viewer's own scores when they resubmit", () => {
    const host = sheet([answered]);
    const found = groups(host);
    const feel = found.get(`feel:${answered.item_id}`) ?? [];
    const wish = found.get(`wish:${answered.item_id}`) ?? [];
    expect(feel.filter((radio) => radio.checked).map((radio) => radio.value)).toEqual(["4"]);
    expect(wish.filter((radio) => radio.checked).map((radio) => radio.value)).toEqual(["2"]);
    const untouched = groups(host).get(`feel:${items[1].item_id}`) ?? [];
    expect(untouched.some((radio) => radio.checked)).toBe(false);
  });
});

describe("the segment is a 44×44 target", () => {
  it("carries the size utilities on every segment", () => {
    const host = sheet();
    const segments = [...host.querySelectorAll("label[data-notch]")];
    expect(segments).toHaveLength(items.length * 2 * 5);
    for (const segment of segments) {
      expect(segment.className).toContain("min-h-[44px]");
      expect(segment.className).toContain("min-w-[44px]");
    }
  });

  it("hides a check glyph on every segment until its own radio is checked", () => {
    const host = sheet([answered]);
    for (const segment of host.querySelectorAll("label[data-notch]")) {
      const glyph = [...segment.querySelectorAll("span")].find((span) => span.textContent === "✓");
      expect(glyph).toBeDefined();
      // CSS-only: the glyph is in the markup and `hidden`; `peer-checked:inline` is what puts
      // it on screen, so the selected state is a shape, not only a fill.
      expect(glyph?.className).toContain("hidden");
      expect(glyph?.className).toContain("peer-checked:inline");
    }
  });
});

describe("nothing here is a slider or a client component", () => {
  const source = readFileSync("components/assessment-flow/answer-form.tsx", "utf8");

  it("carries no slider markup, no toggle-button semantics and no client bundle", () => {
    expect(source).not.toMatch(/type="range"/);
    expect(source).not.toMatch(/role="slider"/);
    expect(source).not.toMatch(/aria-pressed/);
    expect(source).not.toMatch(/use client/);
    expect(source).not.toMatch(/useState|useReducer/);
  });
});
