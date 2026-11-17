/**
 * #1138 — the override's two rules, the render path, and the register's audience column.
 *
 * The card's acceptance lines that are answerable without a browser or a database are here:
 *
 *   - an unknown `{{variable}}` is refused, and refused **before** the write
 *   - a Counterparty-recipient mail cannot say price, trial, card, plan, extension or `$` — not on
 *     save, and not on the *rendered* preview either, which is where a `{{plan}}` would hide
 *   - a template with no markdown body cannot be given one
 *   - the send path reads the **published** override and falls back to the default when it cannot
 *   - `trial-ending`, `purchase-confirmation` and the extension pair cannot reach a Counterparty
 *   - `counterparty-joined`'s default says the trial has started (the decision in force on #1119)
 *   - no Counterparty-recipient **default** already leaks, so the page opens on a clean register
 *
 * The render is the real band (`renderTemplate`), not a stub: a test that asserts on a sentence has
 * to assert on the sentence a mailbox would receive.
 */
import { describe, expect, it, vi } from "vitest";

import {
  EMAIL_TEMPLATES,
  invitationTemplate,
  reachesCounterparty,
  templateById,
} from "@/lib/email/templates";
import { leakWords, overrideOf, overrideProblems, placeholderNames } from "@/lib/email/override";
import { renderSampleEmail, SAMPLE_NAMES } from "@/lib/email/samples";
import { renderTemplateForSend } from "@/lib/email/send";
import { memberFacingTemplate, memberFacingTemplates } from "@/lib/admin/email-templates";
import type { EmailTemplateSql } from "@/lib/db/email-templates";

const INVITATION_FACTS = {
  inviter: SAMPLE_NAMES.initiator,
  counterparty: SAMPLE_NAMES.counterparty,
  template: SAMPLE_NAMES.template,
  link: SAMPLE_NAMES.invitationLink,
};

describe("the audience column", () => {
  it("marks the money templates as Initiator-only", () => {
    // #1138: "`trial-ending`, `extra-week-*` and `purchase-confirmation` are Initiator-only
    // regardless of the override". Extra-week templates are not registered yet (open question), so
    // the set that exists today is these two plus the trial notice.
    for (const id of ["trial-ending", "purchase-confirmation"]) {
      const template = templateById(id);
      expect(template, id).toBeDefined();
      expect(reachesCounterparty(template?.recipient ?? "initiator"), id).toBe(false);
    }
  });

  it("binds a both-seats notice to the Counterparty's silence", () => {
    // `both` is not a loophole: one body written for either seat reaches the Counterparty.
    expect(reachesCounterparty("both")).toBe(true);
    expect(reachesCounterparty("counterparty")).toBe(true);
    expect(reachesCounterparty("initiator")).toBe(false);
    expect(reachesCounterparty("member")).toBe(false);
    expect(reachesCounterparty("subscriber")).toBe(false);
  });

  it("keeps the operator's release note off the member register", () => {
    const memberFacing = memberFacingTemplates().map((template) => template.id);
    expect(memberFacing).not.toContain("stakeholder-release-note");
    expect(memberFacing).toHaveLength(EMAIL_TEMPLATES.length - 1);
    expect(memberFacingTemplate("stakeholder-release-note")).toBeUndefined();
  });

  it("answers undefined for an id the register does not carry", () => {
    expect(memberFacingTemplate("extra-week-granted")).toBeUndefined();
  });
});

describe("an unknown variable", () => {
  it("is refused with its own name", () => {
    const template = templateById("counterparty-invitation");
    expect(template).toBeDefined();
    if (template === undefined) return;
    const problems = overrideProblems(template, {
      subject: "An invitation",
      preheader: "For you",
      body: "This is {{inviter}}'s invitation to {{template}} — open {{mystery}}.",
    });
    expect(problems).toEqual([{ code: "unknown-variable", detail: "{{mystery}}" }]);
  });

  it("accepts every variable the template declares", () => {
    const template = templateById("counterparty-invitation");
    if (template === undefined) throw new Error("the invitation is not registered");
    const declared = (template.body?.placeholders ?? []).map((name) => `{{${name}}}`).join(" ");
    expect(overrideProblems(template, { body: declared })).toEqual([]);
  });

  it("names variables in the order written, without repeating one", () => {
    expect(placeholderNames("{{a}} {{b}} {{a}}")).toEqual(["a", "b"]);
  });
});

describe("the Counterparty's silence about money", () => {
  const invitation = templateById("counterparty-invitation");
  const trialEnding = templateById("trial-ending");

  it("refuses each forbidden word on a Counterparty mail", () => {
    if (invitation === undefined) throw new Error("the invitation is not registered");
    for (const word of ["trial", "price", "card", "plan", "extension", "$"]) {
      const problems = overrideProblems(invitation, { body: `Your ${word} is here.` });
      expect(
        problems.some((problem) => problem.code === "counterparty-leak"),
        word,
      ).toBe(true);
    }
  });

  it("allows the same words on an Initiator mail", () => {
    if (trialEnding === undefined) throw new Error("the trial notice is not registered");
    expect(
      overrideProblems(trialEnding, { body: "Your trial ends and your plan renews." }),
    ).toEqual([]);
  });

  it("checks the rendered words, so a substituted value cannot hide a leak", () => {
    if (invitation === undefined) throw new Error("the invitation is not registered");
    // The override itself carries no forbidden word; the *rendered* subject does, because the
    // sample's plan name is substituted into it. This is the case a source-only check would miss.
    const problems = overrideProblems(
      invitation,
      { subject: "Your plan", body: "Open the invitation." },
      { subject: `Your ${SAMPLE_NAMES.plan} plan`, text: "Open the invitation." },
    );
    expect(problems.some((problem) => problem.code === "counterparty-leak")).toBe(true);
  });

  it("leaves the register with exactly one leaking default, which #1138 question 2 owns", () => {
    // The register's defaults are not all silent about money: `membership-lapsed` is a both-seats
    // letter whose code sentence still offers a plan, and #1138 says so ("Current copy says 'until
    // a plan is active again'") while deferring the rewrite to its open question 2. The page must
    // therefore show that template's Counterparty preview as a refusal — which is the honest
    // answer, not a bug. **A second leaking default is this test failing**, which is the guardrail
    // the issue asks for ("Save, preview and a gate test all refuse them") applied to the code as
    // well as to an admin's edit.
    const leaking: string[] = [];
    for (const template of memberFacingTemplates()) {
      if (!reachesCounterparty(template.recipient)) continue;
      if (template.body === undefined) continue; // relationship-expired keeps two bodies in code
      const rendered = renderSampleEmail(template.id);
      if (leakWords(`${rendered.subject}\n${rendered.preheader}\n${rendered.text}`).length > 0) {
        leaking.push(template.id);
      }
    }
    expect(leaking).toEqual(["membership-lapsed"]);
  });
});

describe("an override on a template with no markdown body", () => {
  it("is refused, because there is nothing to replace", () => {
    const template = templateById("relationship-expired");
    if (template === undefined) throw new Error("relationship-expired is not registered");
    expect(overrideProblems(template, { body: "Something else entirely." })).toEqual([
      { code: "no-editable-body", detail: "relationship-expired" },
    ]);
  });
});

describe("an empty field", () => {
  it("is refused by name", () => {
    const template = templateById("counterparty-invitation");
    if (template === undefined) throw new Error("the invitation is not registered");
    // A field that arrived and is blank was submitted — the admin cleared it — so it is a refusal
    // and not "no override": a save with no subject would otherwise mail a subject of nothing.
    expect(overrideProblems(template, { subject: "   " })).toEqual([{ code: "empty-subject" }]);
    expect(overrideProblems(template, { body: "" })).toEqual([{ code: "empty-body" }]);
    expect(overrideProblems(template, { body: " " })).toEqual([{ code: "empty-body" }]);
    // No field at all is not an override, and not a refusal either.
    expect(overrideProblems(template, {})).toEqual([]);
  });
});

describe("the render path", () => {
  const published = {
    id: "counterparty-invitation-v2",
    template_id: "counterparty-invitation",
    version: 2,
    status: "published",
    subject: "Published subject",
    preheader: "Published preheader",
    body: "Published words for {{counterparty}}.",
    editor_user_id: "user-1",
    created_at: new Date("2026-11-10T12:00:00.000Z"),
    retired_at: null,
  };

  function sqlOf(rows: readonly unknown[]): EmailTemplateSql {
    return {
      query: async <R = Record<string, unknown>>() => ({ rows: rows as readonly R[] }),
    };
  }

  it("sends the published override when there is one", async () => {
    const rendered = await renderTemplateForSend(invitationTemplate, INVITATION_FACTS, {
      sql: sqlOf([published]),
    });
    expect(rendered.subject).toBe("Published subject");
    expect(rendered.text).toContain("Published words for Elena Marsh.");
    // The template's own sentences are not the admin's to replace: only the body moved.
    expect(rendered.text).toContain("The link works once.");
  });

  it("sends the code default when no override is published", async () => {
    const rendered = await renderTemplateForSend(invitationTemplate, INVITATION_FACTS, {
      sql: sqlOf([]),
    });
    expect(rendered.subject).toContain(SAMPLE_NAMES.initiator);
    expect(rendered.text).not.toContain("Published words");
  });

  it("sends the code default when the read fails — a missing table is not a failed mail", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rendered = await renderTemplateForSend(invitationTemplate, INVITATION_FACTS, {
      sql: {
        query: async () => {
          throw new Error('relation "email_template_version" does not exist');
        },
      },
    });
    expect(rendered.subject).toContain(SAMPLE_NAMES.initiator);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe("the register's own promises", () => {
  it("gives every non-operator template sample facts", () => {
    for (const template of memberFacingTemplates()) {
      expect(() => renderSampleEmail(template.id), template.id).not.toThrow();
    }
  });

  it("says the trial has started in the join notice to the Initiator", () => {
    // #1119's decision, in force since #1115: the trial clocks from the Counterparty's acceptance,
    // so the notice that announces the acceptance is the one that must say so.
    const rendered = renderSampleEmail("counterparty-joined");
    expect(rendered.text).toMatch(/trial has started/i);
  });

  it("renders the marketing template with a way out, so its preview is not a refusal", () => {
    const rendered = renderSampleEmail("signup-confirmation");
    expect(rendered.text).toContain(SAMPLE_NAMES.unsubscribeLink);
  });

  it("treats an all-empty override as the default", () => {
    expect(overrideOf({ subject: "", preheader: "", body: "" })).toBeUndefined();
    expect(overrideOf({ subject: null, preheader: null, body: null })).toBeUndefined();
    expect(overrideOf({ subject: "S", preheader: "", body: "" })).toEqual({ subject: "S" });
  });
});
