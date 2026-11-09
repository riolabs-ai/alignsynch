/**
 * Stage 1 — **Details** — has exactly five fields, and this file pins them (#735, copy replaced
 * by the owner's saved pass in #760).
 *
 * `docs/specs/flow-stages.md` → *Stage 1, Details* writes the inventory out because it is the
 * part that has drifted: four fields on a 6/6 grid, the description across all twelve, one help
 * line per field where the artifact draws one, and the stage foot's `Back` beside
 * "Continue to Stage 2". The card's acceptance is therefore a count and an order, not a
 * screenshot a reviewer has to compare by eye:
 *
 *   fixture   the section's ids and labels, in order, exactly — a silent sixth field, a dropped
 *             fifth, or a re-worded help line is red here rather than in a review;
 *   rendered  the same five controls, in the same order, with the same spans, because a fixture
 *             row nothing draws would pass a fixture-only check;
 *   deleted   `email-help` and `submit-note` are gone (the artifact draws neither), and `back` is
 *             the label the secondary action carries.
 *
 * **Every string below is the v7 artifact's `s4.*` value**, character for character: #760 replaced
 * five of these labels and the advance action with the owner's saved copy, and a test that kept
 * the old wording would have been a second, stale source for the same screen. The artifact is the
 * reference the spec is written from
 * (`docs/review/artifacts/prototype-relationship-lifecycle-v7.html`, `s4.*`), and the spec — not
 * this file, and not the build — is what a rename has to change first.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { EMPTY_CREATE_DRAFT } from "@/lib/flow/create-draft";
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
  ["initiator-label", "Your Name as the Relationship Initiator"],
  ["initiator-help", "The seat this relationship is created from."],
  ["counterparty-label", "Counterparty's Name as Seen on the Invite"],
  ["counterparty-placeholder", "Their name"],
  ["counterparty-help", "They will complete their name preference when they claim the invitation."],
  ["email-label", "Email Address used to send the Counterparty Invite"],
  ["email-placeholder", "name@example.com"],
  ["title-label", "Your Personalized Relationship Title"],
  ["title-placeholder", "Relationship Basics"],
  ["title-help", "The personalized name of the created Relationship."],
  ["description-label", "Personalized Relationship Description"],
  [
    "description-placeholder",
    "A sentence on why you are doing this — both of you read it on the card.",
  ],
  ["description-help", "Optional. Shown to both parties, never scored."],
  ["submit", "Continue to Stage 2"],
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
    expect(WHO?.heading).toBe("Relationship Details");
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
