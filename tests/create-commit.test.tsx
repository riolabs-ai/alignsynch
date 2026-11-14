/**
 * Stage 4 **Account** and stage 5 **Invite** (#825, superseding #690's post-commit gate).
 *
 * The card's acceptance is a set of facts about two surfaces, and every one of them is visible in
 * markup — which is why this file renders rather than screenshots:
 *
 *   1. **Stage 4 is a review plus an account, not a second form.** The six facts stages 1–3
 *      decided are printed back (template with its own Aspect count, both seats, the title, the
 *      Mode, the Setting), and the only write on the stage is the advance.
 *   2. **The advance writes a draft and sends nothing.** Its form posts `templateRecordId` **and**
 *      `draft=1` to `POST /assessment/new`; stage 5 is the only place an invitation leaves.
 *   3. **Stage 4 cannot write twice.** Re-entered with the relationship already in hand, the
 *      advance is a link to stage 5 and the form is absent.
 *   4. **Stage 5 decides.** `Send and Continue` posts to the relationship's own `…/send`; `Continue
 *      as Draft` is a link to the relationships list, which is where the draft is kept.
 *   5. **The rail is five cells and says `Stage n of 5`** — there is no `Align` cell to draw, and
 *      the retired `…/create/account` address is not a stage of anything.
 *
 * Rendered with `renderToStaticMarkup` over the real components and the real fixtures: no
 * database, no server, no session. The flows' writes are covered by
 * `tests/flow-store-identity.test.ts` and `scripts/flow-e2e.mjs`.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { MODE_LABELS, SETTING_LABELS } from "@/content/assessment";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import type { CreateDraft } from "@/lib/flow/create-draft";
import {
  CREATE_INSTANCE_PATH,
  createAspectsPath,
  createCommitPath,
  createInviteForPath,
  relationshipPath,
} from "@/lib/flow/paths";
import { itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/**
 * The only Next dependency in the stage shell is `useRouter` (the close button), and this file
 * never navigates: stubbing it keeps the render a render.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

const TEMPLATE_ID = "template-relationship-basics";
/** The same row's slug — what a create-flow URL carries (#794); the id stays the cookie key. */
const TEMPLATE_SLUG = "relationship-basics";
const INSTANCE_ID = "assessment-instance-audit-ready";
/** The relationship stage 4 wrote — what the walk names and what both of its acts land on. */
const RELATIONSHIP_ID = "relationship-audit-ready";

const TEMPLATE = {
  slug: TEMPLATE_SLUG,
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

const ACCOUNT = sectionOf(assessmentCreatePageCopy, "account");
const INVITE = sectionOf(assessmentCreatePageCopy, "invite");
const REVIEW = sectionOf(assessmentCreatePageCopy, "review");

/** Stage 4's account column, as the page builds it — the signed-in confirmation. */
const CONFIRMATION = createElement(
  "p",
  null,
  `${itemLabel(ACCOUNT, "signed-in-heading")} ${itemLabel(ACCOUNT, "signed-in-body")}`,
);

function stage4Html(extra: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(CreateRelationship, {
      copy: assessmentCreatePageCopy,
      stage: 4,
      template: TEMPLATE,
      draft: DRAFT,
      backHref: createAspectsPath(TEMPLATE_SLUG),
      problem: null,
      problemLink: null,
      account: CONFIRMATION,
      ...extra,
    }),
  );
}

function stage5Html(): string {
  return renderToStaticMarkup(
    createElement(CreateRelationship, {
      copy: assessmentCreatePageCopy,
      stage: 5,
      template: TEMPLATE,
      draft: DRAFT,
      instanceRecordId: INSTANCE_ID,
      relationshipId: RELATIONSHIP_ID,
      backHref: createCommitPath(TEMPLATE_SLUG),
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
      backHref: `/templates/relationship/${TEMPLATE_SLUG}/create/mode`,
      problem: null,
      problemLink: null,
    }),
  );
}

describe("stage 4 — the review", () => {
  it("prints the six facts stages 1–3 decided, under their own labels", () => {
    const html = stage4Html();
    for (const id of ["template", "initiator", "counterparty", "title", "mode", "setting"]) {
      expect(html, `expected the ${id} row`).toContain(itemLabel(REVIEW, id));
    }
    expect(html).toContain("Daniel Vance");
    expect(html).toContain("Rowan Mercer");
    expect(html).toContain(DRAFT.title);
    expect(html).toContain(MODE_LABELS[DRAFT.mode as keyof typeof MODE_LABELS]);
    expect(html).toContain(SETTING_LABELS[DRAFT.alignmentSetting as keyof typeof SETTING_LABELS]);
    // The template's own Aspect count, not the list itself.
    expect(html).toContain(`${TEMPLATE.aspectCount}`);
  });

  it("names the stage as the fourth of five, and draws no Align cell", () => {
    const html = stage4Html();
    expect(html).toContain('data-wizard-rail="4"');
    expect(html).toContain("Stage 4 of 5");
    expect(html).not.toContain("Stage 4 of 6");
    expect(html).not.toContain(">Align<");
  });
});

describe("stage 4 — one fact per sentence (#777)", () => {
  /**
   * The stage used to say the same fact up to four times. Option A keeps three sentences and gives
   * each one a fact of its own, so these cases are about the *division*, not the wording: where the
   * answers are, whose account sends the invitation, what state the relationship is in.
   */
  it("says where the answers are once — in the stage paragraph, and nowhere else", () => {
    const body = sectionBody(ACCOUNT);
    expect(body).toBe("Your answers stay on this device until you sign in.");
    const html = stage4Html();
    // Once. A second sentence repeating it is the defect the copy edit removed.
    expect(html.split(body).length - 1, "the stage paragraph is rendered once").toBe(1);
    expect(html).not.toContain("saved on this device");
    // The stage's title is not repeated by the card below it: the header owns the heading (the
    // second copy of the words in the markup is the stage shell's `sr-only` dialog title, which
    // every stage has), and the card used to print the heading and the sentence again inside
    // itself — which put both on screen twice, one above the other.
    expect(html).not.toContain('id="create-account-heading"');
  });

  it("keeps the two facts a person is deciding on: who sends, and what exists", () => {
    // A signed-in creator is still told the invitation leaves from *that* account…
    expect(itemLabel(ACCOUNT, "signed-in-body")).toBe("The invitation is sent from this account.");
    // …and the re-entered state still says the relationship already exists.
    expect(itemLabel(ACCOUNT, "created-body")).toContain("exists as a draft");
    // Neither fact is on this render: the draft state is stage 5's `Back`.
    expect(stage4Html()).not.toContain(itemLabel(ACCOUNT, "created-body"));
  });

  it("carries no item the surfaces do not read", () => {
    // `saved-on-device` is gone rather than left unread: an item in a `.strict()` fixture that no
    // component asks for is drift, and the deleted one said exactly what `body` now says.
    expect((ACCOUNT.items ?? []).map((item) => item.id)).toEqual([
      "signed-in-heading",
      "signed-in-body",
      "created-body",
      "submit",
      "back",
    ]);
  });
});

describe("stage 4 — the conversion writes a draft", () => {
  it("posts the create with draft=1, naming only the template", () => {
    const html = stage4Html();
    expect(html).toContain(`action="${CREATE_INSTANCE_PATH}"`);
    expect(html).toContain(`name="templateRecordId" value="${TEMPLATE_ID}"`);
    expect(html).toContain('name="draft" value="1"');
    expect(html).toContain('data-create-draft="true"');
    expect(html).toContain(itemLabel(ACCOUNT, "submit"));
    expect(html).toContain(sectionBody(ACCOUNT));
  });

  it("says nothing is sent yet, and asks for no account of its own", () => {
    const html = stage4Html();
    // The account column is the page's `LoginView`; the stage writes no password field itself.
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain("data-account-gate-form");
    // The send is stage 5's act, so no label on this stage promises one.
    expect(html).not.toContain(itemLabel(INVITE, "submit"));
  });

  it("cannot write a second relationship: the re-entered stage advances by link", () => {
    const html = stage4Html({
      accountAdvanceHref: createInviteForPath(TEMPLATE_SLUG, INSTANCE_ID),
    });
    expect(html).not.toContain(`action="${CREATE_INSTANCE_PATH}"`);
    expect(html).not.toContain('data-create-draft="true"');
    expect(html).toContain(`href="${createInviteForPath(TEMPLATE_SLUG, INSTANCE_ID)}"`);
    expect(html).toContain('data-create-next="invite"');
  });
});

describe("stage 5 — send or keep", () => {
  it("draws the walk and no create form: the row already exists", () => {
    const html = stage5Html();
    expect(html).toContain('data-pay-step="plan"');
    // No create form on this stage — not the draft's and not a second one for the send.
    expect(html).not.toContain('data-create-draft="true"');
    expect(html).not.toContain(`action="${CREATE_INSTANCE_PATH}"`);
  });

  it("sends from the walk's last step, and from no other place", () => {
    // The stage opens unpaid, so the act does not exist yet: the walk is the gate (#1014).
    const unpaid = stage5Html();
    expect(unpaid).toContain('data-send-gate="locked"');
    expect(unpaid).not.toContain('data-create-send="true"');
    // Paid, the returning state lands on the thank-you, and the act is one step from it.
    const paid = renderToStaticMarkup(
      createElement(CreateRelationship, {
        copy: assessmentCreatePageCopy,
        stage: 5,
        template: TEMPLATE,
        draft: DRAFT,
        instanceRecordId: INSTANCE_ID,
        relationshipId: "relationship-audit-ready",
        backHref: createCommitPath(TEMPLATE_SLUG),
        problem: null,
        problemLink: null,
        initialPaid: true,
      }),
    );
    expect(paid).toContain('data-send-gate="open"');
    expect(paid).toContain('data-pay-action="action"');
    expect(paid).not.toContain('data-create-send="true"');
  });

  it("offers the draft as the second act, and names where it goes", () => {
    const html = stage5Html();
    // #1014 — the draft lands on the relationship itself, which is where the row waits.
    expect(html).toContain(`href="${relationshipPath(RELATIONSHIP_ID)}"`);
    expect(html).toContain('data-create-keep-draft="true"');
    expect(html).toContain(itemLabel(INVITE, "draft"));
    expect(html).toContain(itemLabel(INVITE, "draft-help"));
    // The address the invitation goes to, read back from the row.
    expect(html).toContain(DRAFT.email);
  });

  it("names the stage as the fifth of five", () => {
    const html = stage5Html();
    expect(html).toContain('data-wizard-rail="5"');
    expect(html).toContain("Stage 5 of 5");
  });
});

describe("stage 3 hands over to stage 4", () => {
  it("links to the commit screen by slug and draws no create form", () => {
    const html = stage3Html();
    expect(html).toContain(`href="${createCommitPath(TEMPLATE_SLUG)}"`);
    expect(html).toContain('data-create-next="account"');
    expect(html).not.toContain(`action="${CREATE_INSTANCE_PATH}"`);
  });
});
