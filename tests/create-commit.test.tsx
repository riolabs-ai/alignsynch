/**
 * Stage 4 **Create** and the account gate that follows it (#690).
 *
 * The card's acceptance is a set of facts about two surfaces, and every one of them is visible in
 * markup — which is why this file renders rather than screenshots:
 *
 *   1. **Stage 4 is a review, not a form.** The six facts stages 1–3 decided are printed back
 *      (template with its own Aspect count, both seats, the title, the Mode, the Setting) and the
 *      only writable control is the conversion.
 *   2. **The conversion still needs no account.** Its form posts `templateRecordId` to
 *      `POST /assessment/new`, and nothing on the screen asks for an email address or a password.
 *   3. **The plans are one single-choice group** — `role="radiogroup"`, one `role="radio"` row per
 *      plan, `aria-checked` on each, and **prices from the fixture**: the numbers are read out of
 *      `data/pages/assessment-create.ts`, so a price typed into the markup would be a second
 *      source and this test would not find it.
 *   4. **Stage 3 hands over instead of creating**, so the create sits behind the last stage.
 *   5. **The gate is one surface with a three-step strip, a form and both exits** — and it draws
 *      the strip, not the six-stage rail, because the spec says the account is not a stage.
 *
 * Rendered with `renderToStaticMarkup` over the real components and the real fixtures: no
 * database, no server, no session. The interaction the client components add (choosing a plan,
 * submitting the sign-up) has its own pure test for the keyboard path; the flows' writes are
 * covered by `tests/flow-store-identity.test.ts` and `scripts/flow-e2e.mjs`.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AccountGate } from "@/components/assessment-flow/account-gate";
import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { PLAN_IDS, PlanChoices } from "@/components/assessment-flow/plan-choices";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { MODE_LABELS, SETTING_LABELS } from "@/content/assessment";
import type { CreateDraft } from "@/lib/flow/create-draft";
import {
  CREATE_INSTANCE_PATH,
  OVERVIEW_PATH,
  PRICING_PATH,
  afterCreateTarget,
  createAccountForPath,
  createAspectsPath,
  createCommitPath,
} from "@/lib/flow/paths";
import { itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/**
 * The gate's only Next dependency is `useRouter`, and this file never navigates: stubbing it keeps
 * the render a render. (The real push is a client event, and no gate test presses the button — a
 * static markup render cannot, and pretending otherwise would be a test of the stub.)
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

const TEMPLATE_ID = "template-relationship-basics";
/** The same row's slug — what a create-flow URL carries (#794); the id stays the cookie key. */
const TEMPLATE_SLUG = "relationship-basics";
const INSTANCE_ID = "assessment-instance-audit-ready";

const TEMPLATE = {
  recordId: TEMPLATE_ID,
  title: "Relationship Basics",
  summary: "Ten Aspects about how a working relationship feels and where it should go.",
  aspectCount: 7,
};

/** A draft with every fact stage 4 prints — what a person who walked stages 1–3 carries. */
const DRAFT: CreateDraft = {
  initiatorFirst: "Daniel",
  initiatorLast: "Vance",
  counterpartyFirst: "Rowan",
  counterpartyLast: "Mercer",
  email: "rowan@example.com",
  title: "Quarterly check-in",
  description: "A short reset before the planning cycle.",
  mode: "advanced",
  alignmentSetting: "soft",
};

function stage4Html(): string {
  return renderToStaticMarkup(
    createElement(CreateRelationship, {
      copy: assessmentCreatePageCopy,
      stage: 4,
      template: TEMPLATE,
      draft: DRAFT,
      backHref: createAspectsPath(TEMPLATE_ID),
      problem: null,
      problemLink: null,
    }),
  );
}

function stage3Html(): string {
  return renderToStaticMarkup(
    createElement(CreateRelationship, {
      copy: assessmentCreatePageCopy,
      stage: 3,
      template: TEMPLATE,
      draft: DRAFT,
      aspects: [],
      backHref: `/templates/relationship/${TEMPLATE_ID}/create/mode`,
      problem: null,
      problemLink: null,
    }),
  );
}

describe("stage 4 — the review", () => {
  const review = sectionOf(assessmentCreatePageCopy, "review");

  it("prints the six facts stages 1–3 decided, under their own labels", () => {
    const html = stage4Html();
    for (const id of ["template", "initiator", "counterparty", "title", "mode", "setting"]) {
      expect(html, `expected the ${id} row`).toContain(itemLabel(review, id));
    }
    expect(html).toContain("Daniel Vance");
    expect(html).toContain("Rowan Mercer");
    expect(html).toContain(DRAFT.title);
    expect(html).toContain(MODE_LABELS[DRAFT.mode as keyof typeof MODE_LABELS]);
    expect(html).toContain(SETTING_LABELS[DRAFT.alignmentSetting as keyof typeof SETTING_LABELS]);
    // The template's own Aspect count, not the list itself.
    expect(html).toContain(`${TEMPLATE.aspectCount}`);
  });

  it("names the stage as the fourth of six on the rail", () => {
    const html = stage4Html();
    expect(html).toContain('data-wizard-rail="4"');
    expect(html).toContain("Stage 4 of 6");
  });
});

describe("stage 4 — the conversion", () => {
  const commit = sectionOf(assessmentCreatePageCopy, "commit");

  it("posts the create, naming only the template", () => {
    const html = stage4Html();
    expect(html).toContain(`action="${CREATE_INSTANCE_PATH}"`);
    expect(html).toContain(`name="templateRecordId" value="${TEMPLATE_ID}"`);
    expect(html).toContain(itemLabel(commit, "submit"));
    expect(html).toContain(sectionBody(commit));
  });

  it("asks for no account — no password field, no sign-in link, no gate band", () => {
    const html = stage4Html();
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain("data-create-gate");
    expect(html).not.toContain("data-account-gate-form");
  });
});

describe("stage 4 — the plans", () => {
  const plans = sectionOf(assessmentCreatePageCopy, "plans");

  it("prints the two prices from the fixture, not from the markup", () => {
    const html = stage4Html();
    expect(html).toContain(itemLabel(plans, "one-price"));
    expect(html).toContain(itemLabel(plans, "unlimited-price"));
    expect(html).toContain(itemLabel(plans, "per"));
  });

  it("is one single-choice group: a fieldset of native radios, none pre-selected", () => {
    const html = stage4Html();
    expect(html).toContain("<fieldset");
    expect(html).toContain(`name="plan"`);
    expect(html.match(/type="radio"/g) ?? []).toHaveLength(PLAN_IDS.length);
    expect(html.match(/type="radio"[^>]*checked/g) ?? []).toHaveLength(0);
    // The group carries a name even though the legend is visually hidden.
    expect(html).toContain(itemLabel(plans, "legend"));
  });

  it("marks exactly one row checked when one is chosen — a single choice, not two", () => {
    const html = renderToStaticMarkup(
      createElement(PlanChoices, { copy: assessmentCreatePageCopy, initial: "unlimited" }),
    );
    expect(html.match(/type="radio"[^>]*checked/g) ?? []).toHaveLength(1);
    expect(html).toContain('checked="" value="unlimited"');
  });

  it("leaves the keyboard contract to the browser: one name, arrow keys move within it", () => {
    // Native radios under one `name` are the contract — that is why there is no key handler here
    // to test. The assertion is that the name is shared and the values are the two plan ids.
    const html = stage4Html();
    for (const plan of PLAN_IDS) expect(html).toContain(`value="${plan}"`);
  });

  it("leaves the create open and keeps the payment decision on this screen (#771)", () => {
    /* #771 replaced the `PRICING_PATH` door with the in-place walk: choosing a plan must not leave
       the stage. The old assertions were exactly the flow the owner called wrong. */
    const html = stage4Html();
    expect(html).not.toContain(`href="${PRICING_PATH}"`);
    expect(html).not.toContain('data-create-plans-link="pricing"');
    expect(html).toContain(itemLabel(plans, "add-method-note"));
    expect(html).toContain(itemLabel(plans, "trial"));
    expect(html).toContain('data-pay-step="plan"');
  });
});

describe("where the create sends the browser", () => {
  it("sends a signed-out creator to the gate, naming the relationship it just committed", () => {
    expect(
      afterCreateTarget({
        viewerSignedIn: false,
        templateSlug: TEMPLATE_SLUG,
        instanceRecordId: INSTANCE_ID,
      }),
    ).toBe(createAccountForPath(TEMPLATE_SLUG, INSTANCE_ID));
  });

  it("sends a signed-in creator to the dashboard, and Sent is no longer a destination (#709)", () => {
    expect(
      afterCreateTarget({
        viewerSignedIn: true,
        templateSlug: TEMPLATE_SLUG,
        instanceRecordId: INSTANCE_ID,
      }),
    ).toBe(OVERVIEW_PATH);
  });

  it("has no gate for a post that never came through the flow", () => {
    expect(
      afterCreateTarget({
        viewerSignedIn: false,
        templateSlug: "",
        instanceRecordId: INSTANCE_ID,
      }),
    ).toBe(`/assessment/instances/${INSTANCE_ID}`);
  });
});

describe("stage 3 hands over to stage 4", () => {
  it("links to the commit screen and draws no create form", () => {
    const html = stage3Html();
    expect(html).toContain(`href="${createCommitPath(TEMPLATE_ID)}"`);
    expect(html).toContain('data-create-next="commit"');
    expect(html).not.toContain(`action="${CREATE_INSTANCE_PATH}"`);
  });
});

describe("the account gate after stage 4", () => {
  const account = sectionOf(assessmentCreatePageCopy, "account");
  const backHref = `/assessment/instances/${INSTANCE_ID}`;
  const signInHref = `/login?next=${encodeURIComponent(createAccountForPath(TEMPLATE_SLUG, INSTANCE_ID))}`;

  const html = renderToStaticMarkup(
    createElement(AccountGate, {
      copy: assessmentCreatePageCopy,
      signInHref,
      backHref,
      destination: backHref,
    }),
  );

  it("draws its own three-step strip, not the six-stage rail", () => {
    expect(html).toContain('data-account-gate-progress="true"');
    for (const id of ["step-1", "step-2", "step-3"]) {
      expect(html).toContain(`data-step="${id}"`);
      expect(html).toContain(itemLabel(account, id));
    }
    expect(html.match(/aria-current="step"/g) ?? []).toHaveLength(1);
    expect(html).not.toContain("data-wizard-rail");
    expect(html).not.toContain("Stage 5 of 6");
  });

  it("holds the create-account form", () => {
    expect(html).toContain('data-account-gate-form="true"');
    expect(html).toContain('type="password"');
    expect(html).toContain(itemLabel(account, "submit"));
    expect(html).toContain(itemLabel(account, "email"));
  });

  it("carries both exits: back to what stage 4 created, and the sign-in tab", () => {
    expect(html).toContain(`href="${backHref}"`);
    expect(html).toContain(itemLabel(account, "back"));
    expect(html).toContain('data-account-gate-tab="sign-in"');
    // The sign-in tab returns to this gate, so signing in lands on the relationship.
    expect(signInHref).toContain(
      encodeURIComponent(createAccountForPath(TEMPLATE_SLUG, INSTANCE_ID)),
    );
  });

  it("says nothing it cannot do: no 'nothing is sent' promise on a screen drawn after the send", () => {
    expect(html).not.toContain("Nothing is sent until you finish this step");
    expect(html).toContain(sectionBody(account));
  });
});
