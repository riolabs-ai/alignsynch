/**
 * The screen's two-party arithmetic, and its blind state (#146).
 *
 * Both halves are read out of **static markup**, the way `tests/assessment-report.test.ts`
 * reads the fixture report: the components are server components with no state, so the
 * markup is the screen. What this file adds is the second party:
 *
 *   beginner   with only the Initiator's answers in the rows, the Counterparty's projection
 *              is `report: null` and every Aspect's `own` is `null` — there is no field in
 *              the view model that could carry the other party's scores;
 *   complete   Feel 2 against Feel 5 on `aspect-time-together` renders `data-feel-gap="3"`
 *              (`gapOf(2, 5) === 3`), Wish 5 against Wish 3 renders `2`, and the Aspect the
 *              two parties agree on renders "In synch".
 *
 * The rows are built from the real template fixture, not invented: the Aspect ids, prompts
 * and Values are `data/assessments.ts`'s, which is what the screen would draw.
 *
 * An Advanced instance (#213) is projected the same way: the view model carries `mode`, the
 * viewer's `own` holds four scores instead of two, and the counterparty's Think/Guess are
 * just as absent before `complete` as their Feel/Wish — there is still no field that could
 * carry them.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssessmentReportView } from "@/components/assessment/assessment-report";
import {
  AssessmentInstanceView,
  type InviteNotice,
} from "@/components/assessment-flow/instance-view";
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { assessments } from "@/data/assessments";
import type { PartyRole } from "@/content/assessment";
import type { Assessment } from "@/content/assessment";
import { gapOf } from "@/content/record";
import type { ItemRow, OpinionRow, PartyRow } from "@/lib/db/rows";
import { projectScreen, type FlowInstanceRows } from "@/lib/flow/screen";

const template: Assessment = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("the test's template fixture is missing");
  return found;
})();

const INSTANCE_ID = "instance-flow-test";
const TIME = "aspect-time-together";
const MONEY = "aspect-money";

const items: ItemRow[] = template.items.map((item, position) => ({
  record_id: INSTANCE_ID,
  item_id: item.id,
  position,
  prompt: item.prompt,
  scale_kind: "score",
  left_value: item.leftValue,
  right_value: item.rightValue,
}));

const parties: PartyRow[] = [
  { session_record_id: INSTANCE_ID, role: "initiator", name: "Avery" },
  { session_record_id: INSTANCE_ID, role: "counterparty", name: "Rowan" },
];

/** feel/wish for one party; every Aspect not named here is 3/3. */
function opinionsFor(
  role: PartyRole,
  overrides: Record<string, { feel: number; wish: number }> = {},
): OpinionRow[] {
  return template.items.map((item) => {
    const override = overrides[item.id];
    return {
      session_record_id: INSTANCE_ID,
      role,
      item_id: item.id,
      feel: override?.feel ?? 3,
      wish: override?.wish ?? 3,
      think: null,
      guess: null,
    };
  });
}

/** The same, with all four opinions answered — an Advanced sheet (#213). */
function advancedOpinionsFor(
  role: PartyRole,
  overrides: Record<string, { feel: number; wish: number; think: number; guess: number }> = {},
): OpinionRow[] {
  return template.items.map((item) => {
    const override = overrides[item.id];
    return {
      session_record_id: INSTANCE_ID,
      role,
      item_id: item.id,
      feel: override?.feel ?? 3,
      wish: override?.wish ?? 3,
      think: override?.think ?? 3,
      guess: override?.guess ?? 3,
    };
  });
}

function rowsWith(
  opinions: OpinionRow[],
  answered: Record<PartyRole, number>,
  mode = "basic",
): FlowInstanceRows {
  return {
    record: {
      id: INSTANCE_ID,
      slug: "relationship-basics-test",
      record_type: "assessment",
      status: "draft",
      date: new Date("2026-10-30T12:00:00.000Z"),
      title: template?.title ?? "",
      summary: "answered by Avery and Rowan",
    },
    items,
    options: [],
    instance: {
      record_id: INSTANCE_ID,
      template_record_id: template?.id ?? "",
      relationship_id: "relationship-test",
      mode,
      setting: "soft",
    },
    parties,
    opinions,
    answerCounts: answered,
  };
}

const invite = {
  email: "rowan@example.com",
  counterpartyName: "Rowan",
  expiresAt: "2026-11-06T12:00:00.000Z",
  state: "claimed" as const,
  resentAt: null,
  resentCount: 0,
  link: null,
};

describe("the blind state", () => {
  const initiatorAnswers = opinionsFor("initiator", {
    [TIME]: { feel: 2, wish: 5 },
    [MONEY]: { feel: 4, wish: 4 },
  });

  it("shows the Counterparty no report and none of the Initiator's scores", () => {
    const screen = projectScreen({
      rows: rowsWith(initiatorAnswers, { initiator: items.length, counterparty: 0 }),
      template,
      viewerRole: "counterparty",
      invite,
    });

    expect(screen.status).toBe("answering");
    expect(screen.report).toBeNull();
    expect(screen.aspects.every((aspect) => aspect.own === null)).toBe(true);

    // Nothing in the view model carries the other party's numbers: the ids are the only
    // trace of the Aspects, and 2/5/4 never appear as a score of somebody else's.
    const serialized = JSON.stringify(screen);
    expect(serialized).not.toContain("data-feel-gap");
    expect(serialized).not.toContain('"initiator":2');
  });

  it("shows the Initiator their own answers while they wait, and still no Gap", () => {
    const screen = projectScreen({
      rows: rowsWith(initiatorAnswers, { initiator: items.length, counterparty: 0 }),
      template,
      viewerRole: "initiator",
      invite,
    });

    expect(screen.report).toBeNull();
    expect(screen.aspects.find((aspect) => aspect.itemId === TIME)?.own).toEqual({
      feel: 2,
      wish: 5,
    });
    expect(screen.waiting).toEqual(["counterparty"]);
    expect(screen.invite?.state).toBe("claimed");
  });
});

describe("the coach's read-only view", () => {
  const initiatorAnswers = opinionsFor("initiator", {
    [TIME]: { feel: 2, wish: 5 },
    [MONEY]: { feel: 4, wish: 4 },
  });

  it("is blind on an unfinished session — no report, no score, no count", () => {
    const screen = projectScreen({
      rows: rowsWith(initiatorAnswers, { initiator: items.length, counterparty: 0 }),
      template,
      viewerRole: "coach",
      invite,
    });

    expect(screen.status).toBe("answering");
    expect(screen.viewer.role).toBe("coach");
    expect(screen.viewer.name).toBe("");
    // The blind rule outranks the coach: no report, and nothing of the parties' answers is in
    // the view model — no score, no Gap, no count.
    expect(screen.report).toBeNull();
    expect(screen.aspects.every((aspect) => aspect.own === null)).toBe(true);
    const serialized = JSON.stringify(screen);
    expect(serialized).not.toContain("data-feel-gap");
    expect(serialized).not.toContain('"initiator":2');
  });

  it("reads the report only once the session is scored", () => {
    const both = [
      ...opinionsFor("initiator", { [TIME]: { feel: 2, wish: 5 }, [MONEY]: { feel: 4, wish: 4 } }),
      ...opinionsFor("counterparty", {
        [TIME]: { feel: 5, wish: 3 },
        [MONEY]: { feel: 4, wish: 4 },
      }),
    ];
    const screen = projectScreen({
      rows: rowsWith(both, { initiator: items.length, counterparty: items.length }),
      template,
      viewerRole: "coach",
      invite,
    });

    expect(screen.status).toBe("complete");
    expect(screen.report).not.toBeNull();
  });

  it("draws the Coach badge and no answering control", () => {
    const screen = projectScreen({
      rows: rowsWith(initiatorAnswers, { initiator: items.length, counterparty: 0 }),
      template,
      viewerRole: "coach",
      invite,
    });
    const markup = renderToStaticMarkup(
      createElement(AssessmentInstanceView, { screen, copy: assessmentInstancePageCopy }),
    );

    expect(markup).toContain('data-coach-badge="true"');
    // A coach never answers: the answer form is not drawn, and the viewer band says so.
    expect(markup).not.toContain("Submit answers");
    expect(markup).toContain("You are viewing as Coach");
  });
});

describe("the report, once both have submitted", () => {
  const both = [
    ...opinionsFor("initiator", { [TIME]: { feel: 2, wish: 5 }, [MONEY]: { feel: 4, wish: 4 } }),
    ...opinionsFor("counterparty", { [TIME]: { feel: 5, wish: 3 }, [MONEY]: { feel: 4, wish: 4 } }),
  ];

  const screen = projectScreen({
    rows: rowsWith(both, { initiator: items.length, counterparty: items.length }),
    template,
    viewerRole: "initiator",
    invite,
  });
  const markup =
    screen.report === null
      ? ""
      : renderToStaticMarkup(createElement(AssessmentReportView, { report: screen.report }));

  it("opens for both parties at complete", () => {
    expect(screen.status).toBe("complete");
    expect(screen.report).not.toBeNull();
    expect(screen.report?.rows).toHaveLength(items.length);
  });

  it("renders Feel 2 against Feel 5 as a Gap of 3", () => {
    const row = screen.report?.rows.find((entry) => entry.itemId === TIME);
    expect(row?.left.opinions).toMatchObject({ feel: 2, wish: 5 });
    expect(row?.right.opinions).toMatchObject({ feel: 5, wish: 3 });
    expect(gapOf(2, 5)).toBe(3);
    expect(row?.gaps.feel).toBe(3);
    expect(markup).toContain(
      'data-aspect="aspect-time-together" data-feel-gap="3" data-wish-gap="2"',
    );
  });

  it("renders an agreed Aspect as In Synch", () => {
    const row = screen.report?.rows.find((entry) => entry.itemId === MONEY);
    expect(row?.gaps).toMatchObject({ feel: 0, wish: 0 });
    expect(markup).toContain('data-aspect="aspect-money" data-feel-gap="0" data-wish-gap="0"');
    // Capitalised as the source prints it (#274, SPEC-DRIFT quick win #4), and printed beside
    // the 0 rather than instead of it: the number is the fact, the word is the glossary's.
    expect(markup).toContain("In Synch");
  });

  it("draws the Gap for the Counterparty too — the unlock is symmetric", () => {
    const counterpartyView = projectScreen({
      rows: rowsWith(both, { initiator: items.length, counterparty: items.length }),
      template,
      viewerRole: "counterparty",
      invite,
    });
    expect(counterpartyView.report?.rows.find((row) => row.itemId === TIME)?.gaps.feel).toBe(3);
  });
});

/**
 * #213 — the sheet asks what the mode defines, and an Advanced sheet is just as blind.
 *
 * The rendered counts are the acceptance's numbers, moved to the cheapest place they can be
 * read: five Aspects × 2 kinds = ten selects in Basic, × 4 = twenty in Advanced, in the
 * glossary's order. The live version of the same claim is `scripts/flow-e2e.mjs`, which
 * counts them off a production build against real rows.
 */
describe("an Advanced instance", () => {
  const bothAdvanced = [
    ...advancedOpinionsFor("initiator", {
      [TIME]: { feel: 2, wish: 5, think: 4, guess: 1 },
    }),
    ...advancedOpinionsFor("counterparty", {
      [TIME]: { feel: 5, wish: 3, think: 3, guess: 4 },
    }),
  ];

  const render = (screen: ReturnType<typeof projectScreen>) =>
    renderToStaticMarkup(
      createElement(AssessmentInstanceView, { screen, copy: assessmentInstancePageCopy }),
    );

  it("asks four scores per Aspect, in the glossary's order, and names Advanced Mode", () => {
    const screen = projectScreen({
      rows: rowsWith(bothAdvanced, { initiator: 0, counterparty: 0 }, "advanced"),
      template,
      viewerRole: "initiator",
      invite,
    });

    expect(screen.mode).toBe("advanced");
    const html = render(screen);
    // Five segments per score (#273): four kinds x every Aspect, five radios in each band.
    expect((html.match(/type="radio"/g) ?? []).length).toBe(items.length * 4 * 5);
    const groups = [...html.matchAll(/name="(\w+):aspect-time-together"/g)].map(
      (match) => match[1],
    );
    expect([...new Set(groups)]).toEqual(["feel", "wish", "think", "guess"]);
    expect(html).toContain('data-mode="advanced"');
    expect(html).toContain("Advanced Mode");
  });

  it("asks two scores per Aspect in Basic Mode, and nothing else", () => {
    const screen = projectScreen({
      rows: rowsWith([], { initiator: 0, counterparty: 0 }),
      template,
      viewerRole: "initiator",
      invite,
    });

    expect(screen.mode).toBe("basic");
    const html = render(screen);
    expect((html.match(/type="radio"/g) ?? []).length).toBe(items.length * 2 * 5);
    const groups = [...html.matchAll(/name="(\w+):aspect-time-together"/g)].map(
      (match) => match[1],
    );
    expect([...new Set(groups)]).toEqual(["feel", "wish"]);
    expect(html).toContain('data-mode="basic"');
    expect(html).not.toContain("Advanced Mode");
  });

  it("keeps the counterparty's Think and Guess out of the view model before complete", () => {
    const screen = projectScreen({
      rows: rowsWith(
        [
          ...advancedOpinionsFor("initiator", {
            [TIME]: { feel: 2, wish: 5, think: 4, guess: 1 },
          }),
          ...advancedOpinionsFor("counterparty", {
            [TIME]: { feel: 5, wish: 3, think: 4, guess: 2 },
          }),
        ],
        { initiator: items.length, counterparty: 0 },
        "advanced",
      ),
      template,
      viewerRole: "initiator",
      invite,
    });

    expect(screen.status).toBe("answering");
    expect(screen.report).toBeNull();
    // The viewer's own four scores are there; the other party's 4/2 are nowhere.
    expect(screen.aspects.find((aspect) => aspect.itemId === TIME)?.own).toEqual({
      feel: 2,
      wish: 5,
      think: 4,
      guess: 1,
    });
    const serialized = JSON.stringify(screen);
    expect(serialized).not.toContain('"guess":2');
    // The only party in the projection is the viewer; nobody else's role is carried.
    expect(serialized).not.toContain('"role":"counterparty"');
  });
});

/**
 * The invite notice, as the reader sees it (#220).
 *
 * The bug this closes was a sentence, so the proof is markup: an invitation with a live link,
 * rendered once per outcome. Two claims:
 *
 *   * the reader is never told an environment variable's name, and `failed` never guesses a
 *     cause — a 429, an unverified domain and a bad recipient are all `failed`, so the copy
 *     cannot name any of them;
 *   * the link is drawn in all three, because a mailer that breaks must not make the
 *     invitation unshareable.
 */
describe("the invite notice", () => {
  const TOKEN = "t".repeat(43);
  const link = `http://localhost:3000/invite/${TOKEN}`;
  const unclaimed = {
    email: "rowan@example.com",
    counterpartyName: "Rowan",
    expiresAt: "2026-11-06T12:00:00.000Z",
    state: "unclaimed" as const,
    resentAt: null,
    resentCount: 0,
    link,
  };

  const render = (inviteNotice: InviteNotice | undefined): string => {
    const screen = projectScreen({
      rows: rowsWith([], { initiator: 0, counterparty: 0 }),
      template,
      viewerRole: "initiator",
      invite: unclaimed,
    });
    return renderToStaticMarkup(
      createElement(AssessmentInstanceView, {
        screen,
        copy: assessmentInstancePageCopy,
        inviteNotice,
      }),
    );
  };

  const unset = render("unset");
  const failed = render("failed");
  const sent = render("sent");

  it("never names an environment variable in any of the three", () => {
    for (const html of [unset, failed, sent]) {
      expect(html).not.toContain("RESEND");
      expect(html).not.toContain("API_KEY");
      expect(html).not.toContain("process.env");
    }
  });

  it("says the mailer is absent for `unset`, and does not guess a cause for `failed`", () => {
    expect(unset).toContain('data-invite-notice="unset"');
    expect(unset).toContain("this deployment has no mail sender configured");
    expect(unset).toContain("Send this link yourself");

    expect(failed).toContain('data-invite-notice="failed"');
    expect(failed).toContain("The invitation could not be sent");
    // No cause is named: the reader cannot act on one, and the assertion is the point.
    for (const guess of ["429", "rate limit", "domain", "key", "configured"]) {
      expect(failed.toLowerCase()).not.toContain(guess);
    }
  });

  it("gives the two not-sent outcomes different sentences", () => {
    const sentence = (html: string) =>
      html.slice(html.indexOf("data-invite-notice=")).split("</p>")[0];
    expect(sentence(unset)).not.toBe(sentence(failed));
  });

  it("says who the invitation was emailed to when it was sent", () => {
    expect(sent).toContain('data-invite-notice="sent"');
    expect(sent).toContain("Invitation emailed to rowan@example.com");
  });

  it("renders the link, unresolved, in all three — the flow stays shareable", () => {
    for (const html of [unset, failed, sent]) {
      expect(html).toContain(`<code class="break-all text-xs text-primary">${link}</code>`);
      expect(html).toContain('data-invite-link="true"');
    }
  });

  it("renders no notice for a value this build does not know, and still shows the link", () => {
    const html = render(undefined);
    expect(html).not.toContain("data-invite-notice=");
    expect(html).toContain(link);
  });
});
