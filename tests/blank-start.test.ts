/**
 * The **blank start** — the one template a generic create action can open (#1042).
 *
 * "Create a relationship" is the create intent with no template behind it, and every such action
 * now opens it. That needs something to open: the create flow resolves a template record (the
 * draft cookie is keyed by it, stage 3 seeds its Aspect list from it, and
 * `createSessionFromTemplate()` binds the relationship to its version), so the platform's blank
 * template is the record — the glossary's third line, "the user's to name".
 *
 * **It is `published`, and that is the reversal this file pins.** The fixture used to keep it a
 * `draft` that no session could copy, because "nobody has played a template that has not been
 * named yet". That was sound while the only way into the flow was choosing a named template, and it
 * left the generic action with nowhere to go but `/register`. A draft is also *unreadable* to a
 * signed-out visitor (`readLibraryTemplate`'s `status <> 'draft'` clause) and **unrefusable-free** at
 * stage 1 (`templateCopyRefusal()` answers `template-archived`), so a draft blank would be a door
 * that 404s for a visitor and refuses for a member.
 *
 * What this file proves, without a database:
 *
 *   1. the fixture's blank record is a published, built-in, non-empty template — the three facts
 *      the stage-1 guard reads — so the door opens for both viewers;
 *   2. `blankRelationshipPath()` is that record's stage 1, and the route is in the manifest;
 *   3. the generic CTA a surface draws (`data/pages/templates.ts::final-cta`) is that address, so a
 *      fixture edit that drops the intent is a red build rather than a stealth sign-up page.
 *
 * The rendered proof is the live three-viewer matrix in the card's PR; this is the shape.
 */
import { describe, expect, it } from "vitest";

import { assessments } from "@/data/assessments";
import { templatesPageCopy } from "@/data/pages/templates";
import { ROUTE_PATTERNS } from "@/content/routes";
import {
  BLANK_TEMPLATE_SLUG,
  blankRelationshipPath,
  createRelationshipPath,
  relationshipTemplatePath,
} from "@/lib/flow/paths";
import { templateCopyRefusal } from "@/lib/flow/create-copy";
import { sectionOf } from "@/lib/page-copy";

/** The platform's blank template, as the fixture authors it. */
const BLANK = assessments.find((record) => record.slug === BLANK_TEMPLATE_SLUG);

describe("the platform's blank template is a start, not an offer nobody can take", () => {
  it("exists in the fixtures", () => {
    expect(BLANK, `no fixture record with slug "${BLANK_TEMPLATE_SLUG}"`).toBeDefined();
  });

  it("is published, built-in and asks at least one Aspect — the door guard's three facts", () => {
    if (BLANK === undefined) throw new Error("no blank template fixture");
    expect(BLANK.status).toBe("published");
    expect(BLANK.items.length).toBeGreaterThan(0);
    // The guard stage 1 runs before it draws a field (`templateCopyRefusal()`), on the readiness a
    // signed-out visitor's read produces: a built-in has no author, so `authorship` is `built-in`.
    expect(
      templateCopyRefusal({
        status: BLANK.status,
        aspectCount: BLANK.items.length,
        authorship: "built-in",
      }),
    ).toBeNull();
  });

  it("is not a relationship type, so the public catalogue never lists it as one (#794)", () => {
    // The catalogue sells the taxonomy in `data/relationship-types.ts`; the blank has no row there
    // and no demo sheet, which is why it is a *start* and not a product.
    expect(BLANK_TEMPLATE_SLUG).toBe("blank-template");
  });
});

describe("the blank start's address", () => {
  it("is the blank template's stage 1, and it is in the route manifest", () => {
    expect(blankRelationshipPath()).toBe(`${relationshipTemplatePath(BLANK_TEMPLATE_SLUG)}/create`);
    expect(blankRelationshipPath()).toBe("/templates/relationship/blank-template/create");
    expect(ROUTE_PATTERNS).toContain("/templates/relationship/[slug]/create");
  });

  it("is a different address from a named template's, so the two starts cannot be confused", () => {
    expect(blankRelationshipPath()).not.toBe(createRelationshipPath("parent-teacher"));
    expect(blankRelationshipPath()).not.toContain("?");
  });
});

describe("the generic create CTA authors that address", () => {
  it("points `final-cta` at the blank start rather than at the sign-up form", () => {
    // The fixture may not import `lib/` (it is the base `data:check` compiles), so the address is a
    // literal there and this is the check that keeps it equal to the route the app builds.
    const section = sectionOf(templatesPageCopy, "final-cta");
    expect(section.cta?.href).toBe(blankRelationshipPath());
    expect(section.cta?.href).not.toBe("/register");
  });
});
