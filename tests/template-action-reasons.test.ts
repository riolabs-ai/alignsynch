import { describe, expect, it } from "vitest";

import { REASON_MIN_LENGTH } from "@/lib/admin/act";
import { templateWriteReason } from "@/lib/member/template-reasons";

/**
 * The generated audit sentence has to satisfy `act()`'s floor and the `admin_action` CHECK
 * (`length(btrim(reason)) >= 8`).
 *
 * This is the regression guard for issue #625: the member template forms no longer carry a typed
 * reason, so nothing on the page can produce "A reason of at least eight characters is required".
 * If `REASON_MIN_LENGTH` is ever raised, every case below fails here — in a unit test — instead of
 * in the face of a person who just filled in a form.
 */
describe("templateWriteReason", () => {
  const actions = ["created-blank", "cloned-public", "saved"] as const;
  const scopes = ["member", "console"] as const;

  it("clears the audit floor for every action and scope", () => {
    for (const action of actions) {
      for (const scope of scopes) {
        const reason = templateWriteReason({
          action,
          scope,
          title: "Our Family Check-in",
          sourceTemplateId: "template-parent-child",
        });
        expect(reason.trim().length).toBeGreaterThanOrEqual(REASON_MIN_LENGTH);
      }
    }
  });

  it("stays above the floor when the title is missing or blank", () => {
    for (const action of ["created-blank", "saved"] as const) {
      for (const title of [undefined, "", "   "]) {
        const reason = templateWriteReason({ action, scope: "member", title });
        expect(reason.trim().length).toBeGreaterThanOrEqual(REASON_MIN_LENGTH);
        expect(reason).toContain("an untitled template");
      }
    }
    // A clone names the source id rather than a title, so the fallback is the id's absence.
    const clone = templateWriteReason({ action: "cloned-public", scope: "member" });
    expect(clone.trim().length).toBeGreaterThanOrEqual(REASON_MIN_LENGTH);
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
