/**
 * Stage 1 — **Details** — has exactly seven fields, split into two people, and this file pins
 * them (#825, v9 artifact `s4Who`).
 *
 * `docs/specs/flow-stages.md` → *Stage 1, Details* writes the inventory out because it is the
 * part that has drifted: each seat is first + last, the invitation address and the description
 * close the form, five fields are required and two are not, and the grid is two columns of
 * pairs. The card's acceptance is therefore a count, an order and five marks — never a
 * screenshot a reviewer has to compare by eye:
 *
 *   fixture   the section's ids and labels, in order, exactly — a silent eighth field, a dropped
 *             seventh, or a re-worded help line is red here rather than in a review;
 *   rendered  the same seven controls, in the same order, in the same columns, because a
 *             fixture row nothing draws would pass a fixture-only check;
 *   required  the five required fields carry the asterisk **and** the spoken word, and the two
 *             optional ones carry neither.
 *
 * **Every string below is the v9 artifact's `s4.*` value**, character for character. The spec is
 * written from the artifact and this file is written from the spec; a rename starts there.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { EMPTY_CREATE_DRAFT, type CreateDraft } from "@/lib/flow/create-draft";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/** `StageFoot` links through `next/link`, whose router lives in a request the test has not got. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

/**
 * The inventory, exactly as the spec writes it: the section's items in authored order, id and
 * label. Every string is the artifact's `s4.*` value, and the spec is string-for-string from it.
 */
const INVENTORY = [
  ["title-label", "Your Personalized Relationship Title"],
  ["title-help", "The personalized name of the created Relationship."],
  ["initiator-first-label", "Initiator First Name"],
  ["initiator-last-label", "Initiator Last Name"],
  ["initiator-last-placeholder", "Required"],
  ["initiator-help", "The seat this relationship is created from."],
  ["counterparty-first-label", "Counterparty First Name"],
  ["counterparty-first-placeholder", "Their name"],
  ["counterparty-last-label", "Counterparty Last Name"],
  ["counterparty-last-placeholder", "Optional"],
  ["counterparty-help", "They will complete their name preference when they claim the invitation."],
  ["email-label", "Counterparty Email for Invite"],
  ["email-placeholder", "name@example.com"],
  ["description-label", "Personalized Relationship Description"],
  [
    "description-placeholder",
    "A sentence on why you are doing this — both of you read it on the card.",
  ],
  ["description-help", "Optional. Shown to both parties, never scored."],
  ["required-note", "required"],
  ["submit", "Continue to Stage 2"],
  ["back", "Back"],
] as const;

/** The five fields that carry the mark, in the form's order. */
const REQUIRED = ["title", "initiator-first", "initiator-last", "counterparty-first", "email"];

/** The two that must not. */
const OPTIONAL = ["counterparty-last", "description"];

/** The seven controls, in the completion order the spec fixes. */
const FIELD_IDS = [
  "create-title",
  "create-initiator-first",
  "create-initiator-last",
  "create-counterparty-first",
  "create-counterparty-last",
  "create-email",
  "create-description",
] as const;

const WHO = sectionOf(assessmentCreatePageCopy, "who");

const TEMPLATE = {
  recordId: "template-relationship-basics",
  title: "Relationship Basics",
  summary: "Ten Aspects about how a working relationship feels and where it should go.",
  aspectCount: 2,
};

function stageOne(draft: CreateDraft = EMPTY_CREATE_DRAFT): string {
  return renderToStaticMarkup(
    createElement(CreateRelationship, {
      copy: assessmentCreatePageCopy,
      stage: 1,
      template: TEMPLATE,
      draft,
      backHref: "/templates/relationship/template-relationship-basics",
      problem: null,
      problemLink: null,
    }),
  );
}

/** The markup one field owns: its label through to the next field's. */
function fieldChunk(html: string, field: string): string {
  const start = html.indexOf(`data-field="${field}"`);
  if (start === -1) throw new Error(`no field ${field} on the form`);
  const rest = html.slice(start + 1);
  const next = rest.indexOf('data-field="');
  return next === -1 ? rest : rest.slice(0, next);
}

describe("stage 1 — Details", () => {
  it("carries the spec's inventory in order, and nothing else", () => {
    expect(WHO?.items?.map((item) => [item.id, item.label])).toEqual(
      INVENTORY.map(([id, label]) => [id, label]),
    );
    // The screen's own words are the page's: one heading, one sentence under it.
    expect(assessmentCreatePageCopy.heading).toBe("Relationship Details");
    expect(assessmentCreatePageCopy.subtitle).toBe(
      "Name both people and the relationship. Everything here can change later.",
    );
  });

  it("draws no line the artifact does not draw", () => {
    const ids = WHO?.items?.map((item) => item.id) ?? [];
    // Neither was ever drawn by the artifact, and neither comes back.
    expect(ids).not.toContain("email-help");
    expect(ids).not.toContain("submit-note");
    const html = stageOne();
    expect(html).not.toContain("The invitation goes here.");
    expect(html).not.toContain("Nothing is created yet. The next step fixes the Mode.");
  });

  it("renders the seven fields in the completion order the spec fixes", () => {
    const html = stageOne();
    const positions = FIELD_IDS.map((id) => html.indexOf(`id="${id}"`));
    for (const [index, position] of positions.entries()) {
      expect(position, `${FIELD_IDS[index]} is on the form`).toBeGreaterThan(-1);
      if (index > 0) {
        expect(position, `${FIELD_IDS[index]} follows ${FIELD_IDS[index - 1]}`).toBeGreaterThan(
          positions[index - 1] ?? -1,
        );
      }
    }
    // Seven controls and the hidden template id — an eighth control is the defect this catches.
    expect(html.match(/<(input|textarea)\b/g)?.length).toBe(8);
    expect(html.split('name="templateRecordId"').length - 1).toBe(1);
  });

  it("marks exactly the five required fields, visibly and audibly", () => {
    const html = stageOne();
    for (const field of REQUIRED) {
      const chunk = fieldChunk(html, field);
      // The glyph is `aria-hidden` — a star is not a word — and the spoken label sits beside it.
      expect(chunk, `${field} carries the asterisk`).toContain('aria-hidden="true"');
      expect(chunk, `${field} says the requirement`).toContain(
        `>${itemLabel(WHO, "required-note")}<`,
      );
    }
    for (const field of OPTIONAL) {
      const chunk = fieldChunk(html, field);
      expect(chunk, `${field} is optional, so no mark`).not.toContain('aria-hidden="true"');
      expect(chunk, `${field} is optional, so no spoken requirement`).not.toContain(
        `>${itemLabel(WHO, "required-note")}<`,
      );
    }
    // Five marks on the form, no more: the count is the acceptance, not the per-field check.
    expect(html.split(`>${itemLabel(WHO, "required-note")}<`).length - 1).toBe(5);
  });

  it("lays the form out in the two columns the spec fixes", () => {
    const html = stageOne();
    expect(html).toContain("sm:grid-cols-12");
    // Title | Initiator pair, Counterparty pair | email — two 6s to a row.
    expect(html).toContain('sm:col-span-6" for="create-title"');
    expect(html).toContain('class="grid min-w-0 gap-3 sm:col-span-6" data-pair="initiator"');
    expect(html).toContain('class="grid min-w-0 gap-3 sm:col-span-6" data-pair="counterparty"');
    expect(html).toContain('sm:col-span-6" for="create-email"');
    // The description closes the form full width.
    expect(html).toContain('sm:col-span-12" for="create-description"');
    // A pair is two controls in one column, and collapses to one each below 720px.
    expect(html.split("min-[720px]:grid-cols-2").length - 1).toBe(2);
    expect(html.split("sm:col-span-").length - 1).toBe(5);
  });

  it("derives the title from the names until somebody types in it", () => {
    // Empty names, empty title: the derivation has nothing to say.
    expect(stageOne()).toContain('name="title" value=""');
    // Names in the draft and no title: the title is the derivation, server-rendered, so a form
    // no browser ever hydrated still posts the default.
    const derived = stageOne({
      ...EMPTY_CREATE_DRAFT,
      initiatorFirst: "Daniel",
      initiatorLast: "Vance",
      counterpartyFirst: "Rowan",
      counterpartyLast: "Mercer",
    });
    expect(derived).toContain('value="Daniel V \u2013 Rowan M"');
    // A title the draft already carries is the answer, and wins over the derivation.
    const typed = stageOne({
      ...EMPTY_CREATE_DRAFT,
      initiatorFirst: "Daniel",
      initiatorLast: "Vance",
      counterpartyFirst: "Rowan",
      counterpartyLast: "Mercer",
      title: "Our house, not the dishes",
    });
    expect(typed).toContain('value="Our house, not the dishes"');
  });

  it("defaults the description to the template's own sentence", () => {
    expect(stageOne()).toContain(TEMPLATE.summary);
    // A description the person wrote is theirs, not the template's.
    const typed = stageOne({ ...EMPTY_CREATE_DRAFT, description: "Because we keep arguing." });
    expect(typed).toContain("Because we keep arguing.");
  });

  it("puts `Back` in the foot's left group, beside `Cancel` and nowhere else", () => {
    const html = stageOne();
    expect(html).toContain('data-stage-foot="true"');
    expect(html).toContain('data-create-back="true"');
    expect(html).toContain('data-create-cancel="true"');
    expect(html).toContain(">Back</a>");
    expect(html).toContain(`>${itemLabel(sectionOf(assessmentCreatePageCopy, "foot"), "cancel")}<`);
    // One back affordance on Details: the top link the other stages drew is gone from all four,
    // and Details never had one (#760).
    expect(html.match(/>Back</g)?.length).toBe(1);
  });
});
