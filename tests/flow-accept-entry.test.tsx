/**
 * The accept step is reachable from where a party actually is (#617).
 *
 * Completion requires **both** parties' `party.accepted_at` (`lib/flow/state.ts::instanceStatusOf`,
 * #R2). The accept page, its form and its `/accepts` endpoint all existed — and no surface in the
 * tree linked to the page, so a human-created session could not finish while every fixture-seeded
 * one could (the seed writes `accepted_at` directly). Every existing test POSTed `/accepts`
 * directly, which is exactly why the gate stayed green.
 *
 * So this file asserts the links, on the two surfaces a party is standing on once their own sheet
 * is complete: the confirmation a submit lands on, and the instance screen on any later visit.
 * `scripts/flow-e2e.mjs` follows these anchors against a running app; this is the half that can
 * fail in the gate, with no database and no server.
 *
 * Three states are drawn, and each one has to be honest:
 *
 *   ready      own sheet complete, own acceptance missing → an anchor to `acceptPath()`
 *   accepted   own acceptance recorded, the other seat's missing → the sentence, and no anchor
 *              (a link back to a page whose only control is a button that answers `already-accepted`
 *              is a dead end dressed as a call to action)
 *   unfinished own sheet incomplete → no acceptance band at all; `/accepts` would refuse
 *              `incomplete`, so offering the link would be a promise the endpoint does not keep
 *
 * The markup is read the way the other flow tests read it — `renderToStaticMarkup` over the real
 * component with a screen built by the real `projectScreen()` from real template rows.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AssessmentAcceptPage from "@/app/(mainlayout)/assessment/instances/[instanceId]/accept/page";
import { AssessmentInstanceView } from "@/components/assessment-flow/instance-view";
import { SubmissionConfirmation } from "@/components/assessment-flow/submission-confirmation";
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { assessments } from "@/data/assessments";
import type { Assessment, PartyRole } from "@/content/assessment";
import type { ItemRow, OpinionRow, PartyRow } from "@/lib/db/rows";
import { acceptPath, acceptsPath, answerSheetPath } from "@/lib/flow/paths";
import { projectScreen, type FlowInstanceRows } from "@/lib/flow/screen";

const template: Assessment = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("the test's template fixture is missing");
  return found;
})();

const INSTANCE_ID = "instance-accept-entry";
const ACCEPTED_AT = new Date("2026-11-07T09:00:00.000Z");
const ASPECTS = template.items.length;

const items: ItemRow[] = template.items.map((item, position) => ({
  record_id: INSTANCE_ID,
  item_id: item.id,
  position,
  prompt: item.prompt,
  scale_kind: "score",
  left_value: item.leftValue,
  right_value: item.rightValue,
}));

function partiesWith(acceptance: { initiator: boolean; counterparty: boolean }): PartyRow[] {
  const base: PartyRow[] = [
    { session_record_id: INSTANCE_ID, role: "initiator", name: "Avery" },
    { session_record_id: INSTANCE_ID, role: "counterparty", name: "Rowan" },
  ];
  return base.map((party) => {
    const accepted = party.role === "initiator" ? acceptance.initiator : acceptance.counterparty;
    return accepted ? { ...party, accepted_at: ACCEPTED_AT } : party;
  });
}

/** One opinion row per Aspect, so a sheet is either wholly in or wholly out. */
function opinionsFor(role: PartyRole): OpinionRow[] {
  return template.items.map((item) => ({
    session_record_id: INSTANCE_ID,
    role,
    item_id: item.id,
    feel: 3,
    wish: 3,
    think: null,
    guess: null,
  }));
}

function screenWith(input: {
  answered: { initiator: number; counterparty: number };
  acceptance?: { initiator: boolean; counterparty: boolean };
  viewer: PartyRole | "coach";
}) {
  const rows: FlowInstanceRows = {
    record: {
      id: INSTANCE_ID,
      slug: "relationship-basics-accept-entry",
      record_type: "assessment",
      status: "draft",
      date: new Date("2026-11-07T09:00:00.000Z"),
      title: template.title,
      summary: "answered by Avery and Rowan",
    },
    items,
    options: [],
    instance: {
      record_id: INSTANCE_ID,
      template_record_id: template.id,
      relationship_id: "relationship-accept-entry",
      mode: "basic",
      setting: "soft",
    },
    parties: partiesWith(input.acceptance ?? { initiator: false, counterparty: false }),
    opinions: [
      ...(input.answered.initiator === 0 ? [] : opinionsFor("initiator")),
      ...(input.answered.counterparty === 0 ? [] : opinionsFor("counterparty")),
    ],
    answerCounts: input.answered,
  };

  return projectScreen({
    rows,
    template,
    viewerRole: input.viewer,
    invite: {
      email: "rowan@example.com",
      counterpartyName: "Rowan",
      expiresAt: "2026-11-14T09:00:00.000Z",
      state: "claimed",
      resentAt: null,
      resentCount: 0,
      link: null,
    },
  });
}

/** The anchor a reader would click, found by its own attribute — never by a path we typed. */
function acceptAnchor(markup: string): string | null {
  const anchor = markup.match(/<a\b[^>]*data-accept-link="true"[^>]*>/)?.[0];
  if (anchor === undefined) return null;
  return anchor.match(/href="([^"]*)"/)?.[1] ?? null;
}

describe("the acceptance entry point (#617)", () => {
  const bothAnswered = { initiator: ASPECTS, counterparty: ASPECTS };

  it("links a party from the submit confirmation to the accept page", () => {
    // The Counterparty has just submitted: the visit the submit created, no acceptance on either
    // seat. This is the screen the person is standing on at the end of their own sheet.
    const screen = screenWith({ answered: bothAnswered, viewer: "counterparty" });
    expect(screen.status).toBe("answering");
    expect(screen.report).toBeNull();

    const html = renderToStaticMarkup(
      createElement(AssessmentInstanceView, {
        screen,
        copy: assessmentInstancePageCopy,
        submitted: true,
      }),
    );

    expect(html).toContain("data-submitted-confirmation");
    expect(acceptAnchor(html)).toBe(acceptPath(INSTANCE_ID));
    // The band's own label is the fixture's, not a literal the component invented.
    expect(html).toContain("Review and accept this session");
    // Still blind: a link to the accept step is not a link to the report.
    expect(html).not.toContain("data-feel-gap");
    expect(html).not.toContain(acceptPath(INSTANCE_ID).replace(/\/accept$/, "/report"));
  });

  it("links a party from the instance screen on any later visit", () => {
    // The same seat, a plain visit (`?submitted` absent): the party who closed the tab, or came
    // back to the session from a bookmark. The confirmation band is gone; the way to accept is not.
    const screen = screenWith({ answered: bothAnswered, viewer: "initiator" });
    const html = renderToStaticMarkup(
      createElement(AssessmentInstanceView, { screen, copy: assessmentInstancePageCopy }),
    );

    expect(html).not.toContain("data-submitted-confirmation");
    expect(html).toContain('data-accept-step="ready"');
    expect(acceptAnchor(html)).toBe(acceptPath(INSTANCE_ID));
  });

  it("draws the submit confirmation's answer-sheet link beside it, and no accept link before the sheet is whole", () => {
    const html = renderToStaticMarkup(
      createElement(SubmissionConfirmation, {
        copy: assessmentInstancePageCopy,
        instanceRecordId: INSTANCE_ID,
        otherName: "Avery",
        acceptHref: null,
      }),
    );

    expect(html).toContain(`href="${answerSheetPath(INSTANCE_ID)}"`);
    expect(acceptAnchor(html)).toBeNull();
  });

  it("offers no accept link to a party whose own sheet is unfinished", () => {
    // `acceptSession` refuses this state with `incomplete`; a link here would be a button that
    // cannot work. The sheet itself is drawn instead.
    const screen = screenWith({
      answered: { initiator: ASPECTS - 1, counterparty: ASPECTS },
      viewer: "initiator",
    });

    const html = renderToStaticMarkup(
      createElement(AssessmentInstanceView, { screen, copy: assessmentInstancePageCopy }),
    );

    expect(screen.status).toBe("answering");
    expect(acceptAnchor(html)).toBeNull();
    expect(html).not.toContain("data-accept-step");
  });

  it("replaces the link with the wait once this seat has accepted", () => {
    const screen = screenWith({
      answered: bothAnswered,
      acceptance: { initiator: true, counterparty: false },
      viewer: "initiator",
    });

    const html = renderToStaticMarkup(
      createElement(AssessmentInstanceView, { screen, copy: assessmentInstancePageCopy }),
    );

    expect(screen.status).toBe("answering");
    expect(html).toContain('data-accept-step="accepted"');
    expect(acceptAnchor(html)).toBeNull();
    // The sentence names the seat still to accept — read from the row's name, not a literal.
    expect(html).toContain("Rowan");
  });

  it("draws no acceptance band once both seats have accepted", () => {
    const screen = screenWith({
      answered: bothAnswered,
      acceptance: { initiator: true, counterparty: true },
      viewer: "counterparty",
    });

    const html = renderToStaticMarkup(
      createElement(AssessmentInstanceView, { screen, copy: assessmentInstancePageCopy }),
    );

    expect(screen.status).toBe("complete");
    expect(acceptAnchor(html)).toBeNull();
    expect(html).toContain("data-feel-gap");
  });
});

/**
 * The journey, in the gate (#617).
 *
 * The blocks above prove the anchors exist. This one **follows** one: it renders the instance
 * screen, reads the `href` off the anchor that screen drew, and then drives the real accept page
 * module for that instance — so the form's `action` is the page's own wiring (`acceptsPath()`), not
 * a string this test typed. Two hops of the journey are therefore measured against the app rather
 * than against a copy of its URLs.
 *
 * The third hop needs a write, and the gate must stay database-free: `scripts/flow-e2e.mjs` posts
 * that form as both parties against a running app, follows the redirect to the report, and reads
 * `party.accepted_at` back out of the rows.
 */
const pageStore = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock("@/lib/flow/store", () => ({ readFlowScreen: async () => pageStore.current }));
vi.mock("@/lib/auth/config", () => ({ authConfigured: () => false }));
vi.mock("@/lib/auth/session", () => ({ currentUser: async () => null }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

/** The `action` of the acceptance form, read off the markup the page produced. */
function formActionOf(markup: string): string | null {
  for (const form of markup.match(/<form\b[^>]*>/g) ?? []) {
    const action = form.match(/action="([^"]*)"/)?.[1];
    if (action?.endsWith("/accepts")) return action;
  }
  return null;
}

describe("following the rendered link to the accept form (#617)", () => {
  it("draws an anchor whose target renders the form that records this seat's acceptance", async () => {
    const screen = screenWith({
      answered: { initiator: ASPECTS, counterparty: ASPECTS },
      viewer: "counterparty",
    });

    const instanceHtml = renderToStaticMarkup(
      createElement(AssessmentInstanceView, { screen, copy: assessmentInstancePageCopy }),
    );
    const href = acceptAnchor(instanceHtml);
    expect(href).toBe(acceptPath(INSTANCE_ID));

    // The page reads its instance through `readFlowScreen()` — the same projection this screen came
    // from — and resolves everything else (the viewer, the seats) from those rows.
    pageStore.current = screen;
    const pageElement = await AssessmentAcceptPage({
      params: Promise.resolve({ instanceId: INSTANCE_ID }),
      searchParams: Promise.resolve({}),
    });
    const pageHtml = renderToStaticMarkup(pageElement);

    // The hop: the address the instance screen linked to is the page that posts this seat's
    // acceptance. If either side renames its URL without the other, this fails.
    expect(new URL(href ?? "", "https://instance.invalid").pathname).toBe(acceptPath(INSTANCE_ID));
    expect(formActionOf(pageHtml)).toBe(acceptsPath(INSTANCE_ID));
    // The page draws this seat as the one to act (`data-accepted="no"` on its own row), and the
    // other seat sealed — no score, no Gap, on the page the journey arrives at.
    expect(pageHtml).toContain(`data-party="counterparty" data-accepted="no"`);
    expect(pageHtml).toContain(`data-party="initiator" data-accepted="no"`);
    expect(pageHtml).not.toContain("data-feel-gap");
  });
});
