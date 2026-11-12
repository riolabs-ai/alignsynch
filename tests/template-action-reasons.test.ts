import { describe, expect, it } from "vitest";

import { templateWriteReason } from "@/lib/member/template-reasons";

/**
 * The generated audit sentence names what happened, and where.
 *
 * This is the regression guard for issue #625: the member template forms carry no typed reason, so
 * the sentence is composed from the record's own facts. The floor it used to clear
 * (`REASON_MIN_LENGTH`, eight characters) went with the field — #732 made a reason optional on
 * every action, so nothing is refused for being short any more. What still has to hold is that the
 * composed sentence says which action, which record and which surface.
 */
describe("templateWriteReason", () => {
  it("falls back to a phrase when the title is missing or blank", () => {
    for (const action of ["created-blank", "saved"] as const) {
      for (const title of [undefined, "", "   "]) {
        const reason = templateWriteReason({ action, scope: "member", title });
        expect(reason).toContain("an untitled template");
      }
    }
    // A clone names the source id rather than a title, so the fallback is the id's absence.
    const clone = templateWriteReason({ action: "cloned-public", scope: "member" });
    expect(clone).toContain("(dashboard, templates)");
  });

  it("names the action, so the audit row reads as a sentence", () => {
    expect(
      templateWriteReason({ action: "created-blank", scope: "member", title: "Mine" }),
    ).toMatch(/^Created "Mine" from a blank start \(dashboard, templates\)\.$/);
    expect(
      templateWriteReason({
        action: "cloned-public",
        scope: "member",
        sourceTemplateId: "template-parent-child",
      }),
    ).toContain("Cloned public template template-parent-child");
    expect(templateWriteReason({ action: "saved", scope: "console", title: "Mine" })).toContain(
      "(console, templates)",
    );
  });

  it("never names the member surface for a console write, or the reverse", () => {
    const member = templateWriteReason({ action: "saved", scope: "member", title: "Mine" });
    const console_ = templateWriteReason({ action: "saved", scope: "console", title: "Mine" });
    expect(member).toContain("dashboard");
    expect(member).not.toContain("console");
    expect(console_).toContain("console");
    expect(console_).not.toContain("dashboard");
  });
});
