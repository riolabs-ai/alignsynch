/**
 * **No refusal is a dead end** (#870).
 *
 * The owner hit this live: a template of their own, five Aspects, four stages typed — and stage 5
 * drew a yellow band, the right-hand summary and **nothing else**. No plan, no card, no pay, no
 * Send, no Continue as Draft, no link out. The refusal was correct information; the screen had no
 * handle on it.
 *
 * Three claims, and each one is what would have caught it:
 *
 *   1. **Every code the create path can raise names a destination.** The list is not typed out here
 *      — it is read out of `lib/flow/store.ts`'s `FlowErrorCode` union, so a code added there
 *      without an action fails this suite rather than shipping as a wall. `invalid-input` is the
 *      one allowed exception, and only because the form it is drawn above is the thing it fixes.
 *   2. **A band always draws at least one control**, even when the page names no destination: the
 *      fallback is the relationships list. This is the rule stated as an assertion, because "the
 *      band is visible" and "the person can act" are different facts and only the second one is
 *      the product.
 *   3. **Stage 5 still sends.** The plan notice (#835) is a *notice*, not a refusal: it draws
 *      `data-create-notice` / `role="status"`, and Send + Continue as Draft stay on screen and
 *      enabled. A band that disables the action it is warning about is the old wall in new paint.
 *
 * Rendered with `renderToStaticMarkup` over the real component and the real fixtures: no database,
 * no server, no session. `scripts/flow-e2e.mjs` is the half that proves rows against a live app.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { InviteWalk } from "@/components/assessment-flow/invite-walk";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { EMPTY_CREATE_DRAFT, type CreateDraft } from "@/lib/flow/create-draft";
import { createRefusal, templateCopyRefusal } from "@/lib/flow/create-copy";
import { RELATIONSHIPS_PATH, relationshipTemplatePath } from "@/lib/flow/paths";
import { itemLabel, sectionOf } from "@/lib/page-copy";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

const TEMPLATE = {
  slug: "brother-a-brother-b",
  recordId: "assessment-brother",
  title: "Brother A-Brother B",
  summary: "Five Aspects about how the two of them work.",
  aspectCount: 5,
};

const DRAFT: CreateDraft = {
  ...EMPTY_CREATE_DRAFT,
  initiatorFirst: "Daniel",
  initiatorLast: "Vance",
  counterpartyFirst: "Rowan",
  counterpartyLast: "Mercer",
  email: "rowan@example.com",
  title: "Quarterly check-in",
  mode: "basic",
  alignmentSetting: "soft",
};

const PROBLEMS = sectionOf(assessmentCreatePageCopy, "problems");
const CONTEXT = { slug: TEMPLATE.slug, recordId: TEMPLATE.recordId };

/**
 * Every code the create path can raise, read from the store's own union.
 *
 * The union is the source of truth and this test reads it instead of restating it: a list written
 * out here would agree with itself forever while the store grew a code nobody gave an action.
 */
function flowErrorCodes(): string[] {
  const source = readFileSync("lib/flow/store.ts", "utf8")
    // Strip comments first: the union's prose names codes, and a bare `"code"` inside a doc
    // comment must not be read as a member.
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const union = /export type FlowErrorCode =([\s\S]*?);/.exec(source)?.[1] ?? "";
  return [...union.matchAll(/"([a-z][a-z-]+)"/g)].map((match) => match[1] ?? "");
}

const CODES = flowErrorCodes();

function stageOneHtml(input: {
  problem: string | null;
  problemLink?: { href: string; label: string } | null;
  copyBlocked?: boolean;
  publishAction?: ReturnType<typeof createElement>;
}): string {
  return renderToStaticMarkup(
    createElement(CreateRelationship, {
      copy: assessmentCreatePageCopy,
      stage: 1,
      template: TEMPLATE,
      draft: EMPTY_CREATE_DRAFT,
      backHref: relationshipTemplatePath(TEMPLATE.slug),
      problem: input.problem,
      problemLink: input.problemLink ?? null,
      ...(input.copyBlocked === true ? { copyBlocked: true } : {}),
      ...(input.publishAction === undefined ? {} : { publishAction: input.publishAction }),
    }),
  );
}

/** The controls inside one band: its anchors and buttons, as tags. */
function controlsIn(html: string, marker: string): string[] {
  const start = html.indexOf(marker);
  if (start === -1) return [];
  const rest = html.slice(start);
  const end =
    rest.indexOf("</div></div>") === -1 ? rest.length : start + rest.indexOf("</div></div>");
  const band = html.slice(start, end);
  return [...band.matchAll(/<(a|button)\b[^>]*>/g)].map((match) => match[0] ?? "");
}

describe("the store's refusal codes are enumerated from the source", () => {
  it("finds the union, so a rename of the type cannot silently empty this suite", () => {
    expect(CODES.length).toBeGreaterThanOrEqual(8);
    expect(CODES).toContain("template-archived");
    expect(CODES).toContain("relationship-limit");
  });
});

describe("every refusal the create path can raise carries a way forward (#870)", () => {
  for (const code of CODES) {
    it(`${code} names a destination`, () => {
      const refusal = createRefusal(code, undefined, CONTEXT);
      expect(refusal, `${code} has no sentence — it is a code with no home`).not.toBeNull();
      // The one allowed exception: the form is on screen and the sentence names the field.
      if (code === "invalid-input") {
        expect(refusal?.link).toBeNull();
        return;
      }
      expect(refusal?.link, `${code} names no destination`).not.toBeNull();
      expect(refusal?.link?.href, `${code} points at an empty address`).not.toBe("");
      expect(refusal?.link?.label, `${code} points at a destination with no label`).not.toBe("");
    });

    it(`${code} renders a band with at least one control`, () => {
      const refusal = createRefusal(code, undefined, CONTEXT);
      if (refusal === null) throw new Error(`${code} has no sentence`);
      const html = stageOneHtml({ problem: refusal.sentence, problemLink: refusal.link });
      expect(html).toContain('data-create-problem="true"');
      const controls = controlsIn(html, 'data-create-problem="true"');
      expect(controls.length, `${code} draws a band a person cannot act on`).toBeGreaterThan(0);
    });
  }
});

describe("a band with no named door still offers the exits", () => {
  it("falls back to the relationships list rather than a bare wall", () => {
    const html = stageOneHtml({ problem: itemLabel(PROBLEMS, "unknown-template") });
    expect(html).toContain(`data-create-problem-link="${RELATIONSHIPS_PATH}"`);
    expect(html).toContain(itemLabel(PROBLEMS, "back-to-relationships"));
  });

  it("keeps the named door as the primary act and the list as the second", () => {
    const refusal = createRefusal("template-archived", undefined, CONTEXT);
    const html = stageOneHtml({
      problem: refusal?.sentence ?? null,
      problemLink: refusal?.link ?? null,
    });
    expect(html).toContain(`data-create-problem-link="${relationshipTemplatePath(TEMPLATE.slug)}"`);
    expect(html).toContain(`data-create-problem-secondary="${RELATIONSHIPS_PATH}"`);
  });
});

describe("the door guard answers the same question the store does", () => {
  it("lets a published, versioned template with Aspects through", () => {
    expect(
      templateCopyRefusal({
        status: "published",
        aspectCount: 5,
        authorship: "mine",
        hasVersion: true,
      }),
    ).toBeNull();
  });

  it("refuses an unpublished template at the status, not at the version", () => {
    expect(
      templateCopyRefusal({
        status: "archived",
        aspectCount: 5,
        authorship: "mine",
        hasVersion: true,
      }),
    ).toBe("template-archived");
  });

  it("refuses a published template with no version — the #502b shape", () => {
    expect(
      templateCopyRefusal({
        status: "published",
        aspectCount: 5,
        authorship: "built-in",
        hasVersion: false,
      }),
    ).toBe("template-not-published");
  });

  it("refuses an empty template, and somebody else's, before the store is asked", () => {
    expect(
      templateCopyRefusal({
        status: "published",
        aspectCount: 0,
        authorship: "built-in",
        hasVersion: true,
      }),
    ).toBe("template-has-no-aspects");
    expect(
      templateCopyRefusal({
        status: "published",
        aspectCount: 5,
        authorship: "other",
        hasVersion: true,
      }),
    ).toBe("template-not-yours");
  });

  it("never refuses on a version nobody measured", () => {
    // `hasVersion` absent is "not measured", and a fact nobody read must not become a refusal.
    expect(
      templateCopyRefusal({ status: "published", aspectCount: 5, authorship: "mine" }),
    ).toBeNull();
  });
});

describe("stage 1 collects nothing for a template that cannot be copied", () => {
  it("draws no form and no advance, and keeps the door out", () => {
    const html = stageOneHtml({
      problem: itemLabel(PROBLEMS, "template-archived"),
      copyBlocked: true,
    });
    expect(html).not.toContain('name="templateRecordId"');
    expect(html).not.toContain('name="initiatorFirst"');
    // The band's door and the foot's pair are the whole screen, and both are real controls.
    expect(html).toContain('data-create-problem="true"');
    expect(html).toContain('data-create-back="true"');
    expect(html).toContain('data-create-cancel="true"');
  });

  it("offers the author their one-click publish under the band", () => {
    const publish = createElement(
      "form",
      { action: `/templates/relationship/${TEMPLATE.slug}/status`, method: "post" },
      createElement("button", { type: "submit" }, itemLabel(PROBLEMS, "publish-template")),
    );
    const html = stageOneHtml({
      problem: itemLabel(PROBLEMS, "template-archived"),
      copyBlocked: true,
      publishAction: publish,
    });
    expect(html).toContain(itemLabel(PROBLEMS, "publish-template"));
    expect(html).toContain(`action="/templates/relationship/${TEMPLATE.slug}/status"`);
  });

  it("still draws the form when the refusal is about a field, not the template", () => {
    const html = stageOneHtml({ problem: itemLabel(PROBLEMS, "invalid-input") });
    expect(html).toContain('name="templateRecordId"');
  });
});

describe("stage 5 is not a dead end", () => {
  const stage5 = (
    extra: {
      problem?: string | null;
      problemLink?: { href: string; label: string } | null;
      notice?: string | null;
      noticeLink?: { href: string; label: string } | null;
    } = {},
  ): string =>
    renderToStaticMarkup(
      createElement(CreateRelationship, {
        copy: assessmentCreatePageCopy,
        stage: 5,
        template: TEMPLATE,
        draft: DRAFT,
        backHref: "/back",
        instanceRecordId: "assessment-instance-brother",
        problem: extra.problem ?? null,
        ...(extra.problemLink === undefined ? {} : { problemLink: extra.problemLink }),
        ...(extra.notice === undefined ? {} : { notice: extra.notice }),
        ...(extra.noticeLink === undefined ? {} : { noticeLink: extra.noticeLink }),
      }),
    );

  it("draws the payment walk, the send and the keep-as-draft control on a clean visit", () => {
    const html = stage5();
    expect(html).toContain('data-pay-step="plan"');
    expect(html).toContain('data-create-send="true"');
    expect(html).toContain('data-create-keep-draft="true"');
    expect(html).toContain(itemLabel(sectionOf(assessmentCreatePageCopy, "invite"), "submit"));
  });

  it("keeps all three when a template refusal is what brought the person here", () => {
    // The owner's exact screen: a band, and nothing else. The band is still there — the refusal is
    // correct information — and so are the walk, the send and the way out.
    const refusal = createRefusal("template-archived", undefined, CONTEXT);
    const html = stage5({
      problem: refusal?.sentence ?? null,
      problemLink: refusal?.link ?? null,
    });
    expect(html).toContain('data-create-problem="true"');
    expect(html).toContain('data-pay-step="plan"');
    expect(html).toContain('data-create-send="true"');
    expect(html).toContain('data-create-keep-draft="true"');
    expect(html).toContain(`data-create-problem-link="${relationshipTemplatePath(TEMPLATE.slug)}"`);
    expect(html).toContain(`data-create-problem-secondary="${RELATIONSHIPS_PATH}"`);
  });

  it("still offers a door when the page names none — the fallback is the list", () => {
    const html = stage5({ problem: itemLabel(PROBLEMS, "template-archived") });
    expect(html).toContain(`data-create-problem-link="${RELATIONSHIPS_PATH}"`);
    expect(html).toContain('data-create-send="true"');
  });

  it("keeps Send enabled when only a plan notice is set (#834, #835)", () => {
    const notice = createRefusal("mode-not-entitled", undefined, CONTEXT);
    const html = stage5({ notice: notice?.sentence ?? null, noticeLink: notice?.link ?? null });
    expect(html).toContain('data-create-notice="true"');
    expect(html).toContain('role="status"');
    // A notice that disables the action is the old wall in new paint.
    expect(html).toContain('data-create-send="true"');
    expect(html).not.toMatch(/data-create-send="true"[^>]*\bdisabled\b/);
  });
});

describe("the walk asks only for the decision the account still has (#870)", () => {
  const walk = (accountPlan?: { name: string; entitled: boolean }): string =>
    renderToStaticMarkup(
      createElement(InviteWalk, {
        copy: assessmentCreatePageCopy,
        draft: DRAFT,
        account: createElement("p", null, "The invitation is sent from this account."),
        ...(accountPlan === undefined ? {} : { accountPlan }),
      }),
    );

  it("draws the plan radio group when nothing was measured", () => {
    const html = walk();
    expect(html).toContain('name="plan"');
    expect(html).not.toContain("data-pay-plan-included");
  });

  it("draws a summary instead of the radio group for an entitled account", () => {
    const html = walk({ name: "Principal", entitled: true });
    expect(html).toContain("data-pay-plan-included");
    expect(html).toContain("Principal");
    expect(html).not.toContain('name="plan"');
    // The trial sentence stays: it is the promise the send rests on.
    expect(html).toContain(itemLabel(sectionOf(assessmentCreatePageCopy, "plans"), "trial"));
  });

  it("keeps the radio group for an account whose plan does not include what it asked for", () => {
    const html = walk({ name: "Free", entitled: false });
    expect(html).toContain('name="plan"');
    expect(html).not.toContain("data-pay-plan-included");
  });

  it("never draws a card form, whichever panel is open", () => {
    // The owner's rule: choosing a plan commits nothing and nothing here charges. A mock checkout
    // is worse than no checkout, so a `card`/`cvc` input in the walk is a red suite.
    for (const html of [walk(), walk({ name: "Principal", entitled: true })]) {
      expect(html).not.toMatch(/name="(card|cvc|cardnumber|expiry)"/i);
    }
  });
});
