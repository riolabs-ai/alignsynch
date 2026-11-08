/**
 * Stage 1 — **Details** — has exactly five fields, and this file pins them (#735).
 *
 * `docs/specs/flow-stages.md` → *Stage 1, Details* writes the inventory out because it is the
 * part that has drifted: four fields on a 6/6 grid, the description across all twelve, one help
 * line per field where the artifact draws one, and the stage foot's `Back` beside
 * "Continue to mode and setting". The card's acceptance is therefore a count and an order, not a
 * screenshot a reviewer has to compare by eye:
 *
 *   fixture   the section's ids and labels, in order, exactly — a silent sixth field, a dropped
 *             fifth, or a re-worded help line is red here rather than in a review;
 *   rendered  the same five controls, in the same order, with the same spans, because a fixture
 *             row nothing draws would pass a fixture-only check;
 *   deleted   `email-help` and `submit-note` are gone (the artifact draws neither), and `back` is
 *             the label the secondary action carries.
 *
 * The artifact is the reference the spec was written from
 * (`docs/review/artifacts/prototype-relationship-lifecycle-v5.html`, `s4.*`), and the spec — not
 * this file, and not the build — is what a rename has to change first.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { EMPTY_CREATE_DRAFT } from "@/lib/flow/create-draft";

/** `StageFoot` links through `next/link`, whose router lives in a request the test has not got. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

/**
 * The inventory, exactly as the spec writes it: the section's items in authored order, id and
 * label. Every string is the artifact's `s4.*` value, and the spec is string-for-string from it.
 */
const INVENTORY = [
  ["initiator-label", "Your name — the Initiator"],
  ["initiator-help", "The seat this relationship is created from."],
  ["counterparty-label", "Who you are asking"],
  ["counterparty-placeholder", "Their name"],
  [
    "counterparty-help",
    "Display only: the seat is filled when they claim the invitation. A name typed here is not a party.",
  ],
  ["email-label", "Their email address"],
  ["email-placeholder", "name@example.com"],
  ["title-label", "What are you in the middle of"],
  ["title-placeholder", "Relationship Basics"],
  ["title-help", "The card title both of you see."],
  ["description-label", "Description"],
  [
    "description-placeholder",
    "A sentence on why you are doing this — both of you read it on the card.",
  ],
  ["description-help", "Optional. Shown to both parties, never scored."],
  ["submit", "Continue to mode and setting"],
  ["back", "Back"],
] as const;

const WHO = assessmentCreatePageCopy.sections?.find((section) => section.id === "who");

function stageOne(): string {
  return renderToStaticMarkup(
    createElement(CreateRelationship, {
      copy: assessmentCreatePageCopy,
      stage: 1,
      template: {
        recordId: "template-relationship-basics",
        title: "Relationship Basics",
        summary: "Ten Aspects about how a working relationship feels and where it should go.",
        aspectCount: 2,
      },
      draft: EMPTY_CREATE_DRAFT,
      backHref: "/assessment/templates/template-relationship-basics",
      problem: null,
      problemLink: null,
    }),
  );
}

/** The five controls the stage asks, in the order the spec lists them. */
const FIELD_IDS = [
  "create-initiator-name",
  "create-counterparty-name",
  "create-email",
  "create-title",
  "create-description",
] as const;

describe("stage 1 — Details", () => {
  it("carries the spec's fields, labels and help in order, and nothing else", () => {
    expect(WHO).toBeDefined();
    expect(WHO?.items?.map((item) => [item.id, item.label])).toEqual(
      INVENTORY.map(([id, label]) => [id, label]),
    );
    // The heading and body are the artifact's too (`s4.heading`, `s4.body`).
    expect(WHO?.heading).toBe("Who and how");
    expect(WHO?.body).toBe(
      "One template, two seats, and the facts that shape every screen after this one.",
    );
  });

  it("draws no line the artifact does not draw", () => {
    const ids = WHO?.items?.map((item) => item.id) ?? [];
    // Both were removed by #735: the address has no help line and the step has no submit note.
    expect(ids).not.toContain("email-help");
    expect(ids).not.toContain("submit-note");
    const html = stageOne();
    expect(html).not.toContain("The invitation goes here.");
    expect(html).not.toContain("Nothing is created yet. The next step fixes the Mode.");
  });

  it("renders the five fields in the spec's order", () => {
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
    // Exactly five: a sixth control in the form is the defect the inventory exists to catch.
    expect(html.split('name="initiatorName"').length - 1).toBe(1);
    expect(html.match(/<(input|textarea)\b/g)?.length).toBe(6); // five fields + the hidden template id
  });

  it("lays them out on the 12-column grid the spec fixes — four 6s and one 12", () => {
    const html = stageOne();
    expect(html).toContain("sm:grid-cols-12");
    for (const id of ["create-initiator-name", "create-counterparty-name", "create-email"]) {
      expect(html, `${id}'s label is a 6`).toContain(`sm:col-span-6" for="${id}"`);
    }
    // `create-title` is the fourth 6 and `create-description` is the one 12.
    expect(html).toContain('sm:col-span-6" for="create-title"');
    expect(html).toContain('sm:col-span-12" for="create-description"');
    expect(html.match(/sm:col-span-/g)?.length).toBe(5);
  });

  it("puts `Back` beside the primary action, and nowhere else on the stage", () => {
    const html = stageOne();
    expect(html).toContain('data-create-back="true"');
    expect(html).toContain(">Back</a>");
    // One back affordance on Details: the top link the other stages draw is not here.
    expect(html.match(/>Back</g)?.length).toBe(1);
  });
});
