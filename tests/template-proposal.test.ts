/**
 * Propose to Library — the form's rules (#1130).
 *
 * The issue's acceptance line is two claims: **Propose to Library cannot publish**, and **the consent
 * box is required**. Both are proved here without a browser, because both are properties of a pure
 * function, and a rendered form would only photograph one state of it.
 *
 *   1. every required field is required — name, category (one of the five shelves), who it is for;
 *   2. consent is a **rule**: the boolean `true` (or the string a plain form posts), never the field's
 *      mere presence, so a hand-crafted body cannot agree to nothing;
 *   3. a valid proposal carries the normalised fields and no handle a write could use — there is no
 *      `status`, no `visibility` and no `published` anywhere in it, which is the shape that makes
 *      "a proposal is not a publish" true by construction rather than by a comment.
 */
import { describe, expect, it } from "vitest";

import { TEMPLATE_CATEGORIES } from "@/data/template-categories";
import { validateProposal } from "@/lib/member/proposal";

const VALID = {
  templateId: "assessment-weekly-reset",
  name: "Our Weekly Reset",
  category: "family" as const,
  who: "Two people who share a household and want a standing check-in.",
  note: "Works best on a Sunday evening.",
  consent: true,
};

describe("the consent box is a rule, not a checkbox's paint", () => {
  it("refuses without consent, and refuses the string 'on' a hand-crafted body posts", () => {
    expect(validateProposal({ ...VALID, consent: false })).toEqual({
      ok: false,
      code: "consent-required",
    });
    expect(validateProposal({ ...VALID, consent: undefined })).toEqual({
      ok: false,
      code: "consent-required",
    });
    // A raw form posts `"on"` for a checked box; only the server's own boolean (or `"true"`) agrees.
    expect(validateProposal({ ...VALID, consent: "on" })).toEqual({
      ok: false,
      code: "consent-required",
    });
    expect(validateProposal({ ...VALID, consent: "true" }).ok).toBe(true);
  });

  it("checks consent last, so a person fixes the field they can see first", () => {
    // The order is the form's reading order: name, category, who, then the box at the foot.
    expect(validateProposal({ ...VALID, name: "  ", consent: false })).toEqual({
      ok: false,
      code: "name-required",
    });
    expect(validateProposal({ ...VALID, category: "", consent: false })).toEqual({
      ok: false,
      code: "category-required",
    });
    expect(validateProposal({ ...VALID, who: "", consent: false })).toEqual({
      ok: false,
      code: "who-required",
    });
  });
});

describe("every required field is required", () => {
  it("refuses a whitespace-only name or audience rather than storing a blank", () => {
    expect(validateProposal({ ...VALID, name: "   " })).toEqual({
      ok: false,
      code: "name-required",
    });
    expect(validateProposal({ ...VALID, who: "\n\t " })).toEqual({
      ok: false,
      code: "who-required",
    });
  });

  it("accepts only the five shelves the Library files by", () => {
    for (const category of TEMPLATE_CATEGORIES) {
      expect(validateProposal({ ...VALID, category }).ok).toBe(true);
    }
    expect(validateProposal({ ...VALID, category: "Family" })).toEqual({
      ok: false,
      code: "category-required",
    });
    expect(validateProposal({ ...VALID, category: "nonsense" })).toEqual({
      ok: false,
      code: "category-required",
    });
  });

  it("needs an id to propose — an empty one names no template at all", () => {
    expect(validateProposal({ ...VALID, templateId: "" })).toEqual({
      ok: false,
      code: "no-such-template",
    });
  });
});

describe("a valid proposal is a request, never a publish", () => {
  it("carries the four fields and the optional note, normalised", () => {
    const result = validateProposal({ ...VALID, name: "  Our Weekly Reset  " });
    expect(result).toEqual({
      ok: true,
      proposal: {
        templateId: "assessment-weekly-reset",
        name: "Our Weekly Reset",
        category: "family",
        who: "Two people who share a household and want a standing check-in.",
        note: "Works best on a Sunday evening.",
      },
    });
  });

  it("an empty note is `null` — nobody wrote one, and that is not an empty string", () => {
    const result = validateProposal({ ...VALID, note: "   " });
    expect(result.ok && result.proposal.note).toBeNull();
  });

  it("carries no field that could publish, offer or hide anything", () => {
    const result = validateProposal(VALID);
    if (!result.ok) throw new Error("the valid payload was refused");
    const keys = Object.keys(result.proposal).sort();
    expect(keys).toEqual(["category", "name", "note", "templateId", "who"]);
    // A status, a visibility or a published flag here would be the write this form must never make.
    const serialised = JSON.stringify(result.proposal);
    for (const word of ["published", "visibility", "status", "version"]) {
      expect(serialised).not.toContain(word);
    }
  });
});
