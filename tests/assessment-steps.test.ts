/**
 * The Steps panel and the write behind it (#478) — the `/v1` prototype's `steps-panel.tsx` ported
 * into the instance screen, and `tests/v1-steps.test.ts` retired.
 *
 * Two halves, because the port has two halves:
 *
 *   1. **the panel** — what a party and a coach are drawn, asserted on `AssessmentInstanceView`'s own
 *      markup: the panel exists only in the report state (a Step names a Gap, so drawing one earlier
 *      would be the blind rule leaking by another door), a party gets a tick and a reword, a coach
 *      gets neither, and a closed Step gets no form at all;
 *   2. **the write** — `writeStep()` driven against a stub `pg` client, the pattern
 *      `tests/flow-store-identity.test.ts` established: the ported test's real claim was
 *      "a tick is persisted", and persisting it means one UPDATE, in one transaction, behind the
 *      seat check and the completeness check. Each refusal is a case, because each one is a status
 *      code the endpoint returns.
 *
 * The v1 test asserted this against `lib/v1/store.tsx`'s in-browser store, which is why the module it
 * needed (`lib/v1/persona.ts`) survived the deletion cohort. Both are gone with this card.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const stub = vi.hoisted(() => ({
  queries: [] as { text: string; values?: unknown[] }[],
  /** What the stub answers, per statement kind. */
  session: { relationship_id: "rel-1" } as { relationship_id: string } | undefined,
  tokenRole: "initiator" as "initiator" | "counterparty" | undefined,
  userRole: undefined as "initiator" | "counterparty" | undefined,
  itemCount: 2,
  /** The two `party` rows `progressOfClient` counts. */
  parties: [
    { role: "initiator", answered: 2, accepted: true },
    { role: "counterparty", answered: 2, accepted: true },
  ] as { role: string; answered: number; accepted: boolean }[],
  steps: [] as Record<string, unknown>[],
  rowCount: 1,
}));

vi.mock("@/lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/client")>();
  const client = {
    query: (text: string, values?: unknown[]) => {
      stub.queries.push({ text, values });
      const sql = text.replace(/\s+/g, " ").trim();
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return Promise.resolve({ rows: [], rowCount: null });
      }
      if (sql.startsWith("SELECT relationship_id FROM session")) {
        return Promise.resolve({ rows: stub.session === undefined ? [] : [stub.session] });
      }
      if (sql.startsWith("SELECT role FROM party") && sql.includes("access_token_hash")) {
        return Promise.resolve({
          rows: stub.tokenRole === undefined ? [] : [{ role: stub.tokenRole }],
        });
      }
      if (sql.startsWith("SELECT role FROM party") && sql.includes("user_id")) {
        return Promise.resolve({
          rows: stub.userRole === undefined ? [] : [{ role: stub.userRole }],
        });
      }
      if (sql.startsWith("SELECT count(*)::int AS count FROM item")) {
        return Promise.resolve({ rows: [{ count: stub.itemCount }] });
      }
      if (sql.startsWith("SELECT p.role")) {
        return Promise.resolve({ rows: stub.parties });
      }
      if (sql.startsWith("SELECT") && sql.includes("FROM step WHERE relationship_id")) {
        return Promise.resolve({ rows: stub.steps });
      }
      if (sql.startsWith("UPDATE step")) {
        return Promise.resolve({ rows: [], rowCount: stub.rowCount });
      }
      return Promise.reject(new Error(`the stub does not answer: ${sql}`));
    },
    release: () => undefined,
  };
  return {
    ...actual,
    getPool: () => ({ connect: () => Promise.resolve(client) }),
  };
});

import { AssessmentInstanceView } from "@/components/assessment-flow/instance-view";
import { StepsPanel } from "@/components/assessment-flow/steps-panel";
import type { Assessment, PartyRole } from "@/content/assessment";
import type { Step } from "@/content/steps";
import { STEP_STATUS_LABELS, AUTHORED_STEP_LABEL } from "@/content/steps";
import { assessments } from "@/data/assessments";
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import type { ItemRow, OpinionRow, PartyRow } from "@/lib/db/rows";
import { projectScreen, type FlowInstanceRows } from "@/lib/flow/screen";
import { stepsPath } from "@/lib/flow/paths";
import { writeStep } from "@/lib/flow/store";

/* ------------------------------------------------------------------ *\
 * Fixtures
 * ------------------------------------------------------------------ */

const INSTANCE_ID = "instance-steps-1";
const RELATIONSHIP_ID = "rel-1";
const CREATED_AT = "2026-11-03T10:00:00.000Z";
const template = assessments.find(
  (candidate) => candidate.id === "assessment-relationship-basics",
) as Assessment;

function stepOf(overrides: Partial<Step> & { id: string; aspectId: string }): Step {
  const base: Step = {
    relationshipId: RELATIONSHIP_ID,
    derivedFrom: ["feel"],
    suggestedText: "The prompt — Feel of 3. Say what the difference is about.",
    text: "The prompt — Feel of 3. Say what the difference is about.",
    status: "open",
    createdAt: CREATED_AT,
    ...overrides,
  };
  return base;
}

const aspects = [
  { itemId: "aspect-a", prompt: "How this feels" },
  { itemId: "aspect-b", prompt: "What we want instead" },
];

const steps: Step[] = [
  stepOf({ id: "step-1-a", aspectId: "aspect-a" }),
  stepOf({
    id: "step-2-a-own",
    aspectId: "aspect-a",
    derivedFrom: [],
    suggestedText: undefined,
    text: "Write the agenda",
    status: "done",
  }),
  stepOf({ id: "step-3-b", aspectId: "aspect-b", status: "closed" }),
  stepOf({ id: "step-4-c", aspectId: "aspect-c", text: "Our own words" }),
];

function panel(overrides: { steps?: readonly Step[]; canMark?: boolean; aligned?: boolean } = {}) {
  return renderToStaticMarkup(
    createElement(StepsPanel, {
      steps: overrides.steps ?? steps,
      aspects,
      action: stepsPath(INSTANCE_ID),
      canMark: overrides.canMark ?? true,
      aligned: overrides.aligned ?? false,
      copy: assessmentInstancePageCopy,
    }),
  );
}

/** The `<li>` for one Step, so a case can assert about that row and nothing else. */
function rowOf(html: string, stepId: string): string {
  const start = html.indexOf(`data-step-id="${stepId}"`);
  if (start === -1) throw new Error(`no row for ${stepId}`);
  const end = html.indexOf("</li>", start);
  return html.slice(start, end);
}

/** The `<form>` whose hidden `stepId` names this Step, so a case can read the status it posts. */
function formOf(html: string, stepId: string): string {
  for (const match of html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)) {
    if (match[1].includes(`value="${stepId}"`)) return match[1];
  }
  throw new Error(`no form posts ${stepId}`);
}

/* ------------------------------------------------------------------ *\
 * The panel
 * ------------------------------------------------------------------ */

describe("the Steps panel", () => {
  it("groups by Aspect in the instance's own order, and keeps an Aspect the instance no longer holds", () => {
    const html = panel();
    const order = [
      html.indexOf('data-steps-aspect="aspect-a"'),
      html.indexOf('data-steps-aspect="aspect-b"'),
      html.indexOf('data-steps-aspect="aspect-c"'),
    ];
    expect(order.every((index) => index > -1)).toBe(true);
    expect(order).toEqual([...order].sort((left, right) => left - right));

    // The prompts are the screen's; an Aspect it no longer holds is named by its id rather than
    // dropped, because the Step outlives the Aspect.
    expect(html).toContain("How this feels");
    expect(html).toContain("What we want instead");
    expect(html).toContain("aspect-c");
  });

  it("counts what is still work, not what is stored: a closed Step is history, not a denominator", () => {
    const html = panel();
    // 4 rows, 1 closed, 1 done → "1 of 3 done", and the closed one said out loud.
    expect(html).toContain("1 of 3 done");
    expect(html).toContain("1 closed");
  });

  it("posts a tick that carries only the Step and the status it wants next", () => {
    const html = panel();

    // An open Step ticks to done; a done Step's tick takes it back.
    expect(formOf(html, "step-1-a")).toContain('name="status" value="done"');
    expect(formOf(html, "step-2-a-own")).toContain('name="status" value="open"');

    // Every form posts to the endpoint and names no role, no token, no relationship: the seat is
    // resolved from the cookie inside the store's transaction.
    expect(html).toContain(`action="${stepsPath(INSTANCE_ID)}"`);
    expect(html).not.toContain('name="role"');
    expect(html).not.toContain('name="token"');
    expect(html).not.toContain('name="relationshipId"');
  });

  it("offers a reword as a form beside the tick — never nested in it, and pre-filled with the words", () => {
    const html = panel();
    const row = rowOf(html, "step-1-a");
    expect(row).toContain("data-step-edit-form");
    expect(row).toContain("<textarea");
    expect(row).toContain("The prompt — Feel of 3.");

    // Two sibling forms on a row, never one inside the other: a nested form is invalid markup and a
    // browser drops the inner one silently.
    const rowStart = html.indexOf('data-step-id="step-1-a"');
    const rowEnd = html.indexOf("</li>", rowStart);
    const slice = html.slice(rowStart, rowEnd);
    const opens = (slice.match(/<form\b/g) ?? []).length;
    const closes = (slice.match(/<\/form>/g) ?? []).length;
    expect(opens).toBe(2);
    expect(closes).toBe(2);
  });

  it("gives a closed Step no tick and no edit: its words are a record, not a plan", () => {
    const row = rowOf(panel(), "step-3-b");
    expect(row).not.toContain("data-step-toggle");
    expect(row).not.toContain("data-step-edit-form");
    expect(row).not.toContain("<form");
    expect(row).toContain(STEP_STATUS_LABELS.closed);
    expect(row).toContain("No Gap left on this Aspect; kept as history");
  });

  it("repeats the suggestion only once a party has reworded the Step", () => {
    const html = panel();
    // Reworded: the words read first, the suggestion beneath them.
    expect(rowOf(html, "step-4-c")).toContain("data-step-suggestion");
    expect(rowOf(html, "step-4-c")).toContain("Our own words");
    // Never reworded: the text *is* the suggestion, and printing it twice would be noise.
    expect(rowOf(html, "step-1-a")).not.toContain("data-step-suggestion");
  });

  it("names a Step's provenance — the Gap kinds it came from, or the authored label", () => {
    const html = panel();
    expect(rowOf(html, "step-1-a")).toContain("Feel");
    expect(rowOf(html, "step-2-a-own")).toContain(AUTHORED_STEP_LABEL);
  });

  it("hands a coach the plan and no controls, and says so", () => {
    const html = panel({ canMark: false });
    expect(html).toContain("data-steps-panel");
    expect(html).toContain("data-steps-read-only");
    expect(html).not.toContain("data-step-toggle");
    expect(html).not.toContain("data-step-edit-form");
    // The rows are still readable, with their state.
    expect(rowOf(html, "step-1-a")).toContain(STEP_STATUS_LABELS.open);
  });

  it("says there is nothing yet, and distinguishes 'nothing derived' from 'nothing to work on'", () => {
    const blank = panel({ steps: [] });
    expect(blank).toContain("data-steps-empty");
    expect(blank).toContain("No Steps yet");
    expect(blank).toContain("Steps appear when you both accept a session");

    const aligned = panel({ steps: [], aligned: true });
    expect(aligned).toContain(
      "Every Gap on the last session was In Synch, so there is nothing to work on.",
    );
    expect(aligned).not.toContain("Steps appear when you both accept a session");
    // An empty panel has no progress line to divide by zero.
    expect(aligned).not.toContain("data-steps-progress");
  });
});

/* ------------------------------------------------------------------ *\
 * The panel inside the instance screen
 * ------------------------------------------------------------------ */

function itemsOf(): ItemRow[] {
  return template.items.map((item, position) => ({
    record_id: INSTANCE_ID,
    item_id: item.id,
    position,
    prompt: item.prompt,
    scale_kind: "score",
    left_value: item.leftValue,
    right_value: item.rightValue,
  }));
}

function opinionsFor(role: PartyRole): OpinionRow[] {
  return template.items.map((item) => ({
    session_record_id: INSTANCE_ID,
    role,
    item_id: item.id,
    feel: 3,
    wish: 4,
    think: 2,
    guess: 2,
  }));
}

/** The same screen the instance page builds: `answered` decides whether both seats have answered. */
function screenOf(answered: "both" | "initiator-only", viewerRole: "initiator" | "coach") {
  const items = itemsOf();
  const parties: PartyRow[] = [
    {
      session_record_id: INSTANCE_ID,
      role: "initiator",
      name: "Avery",
      accepted_at: new Date(CREATED_AT),
    },
    {
      session_record_id: INSTANCE_ID,
      role: "counterparty",
      name: "Rowan",
      accepted_at: new Date(CREATED_AT),
    },
  ];
  return projectScreen({
    rows: {
      record: {
        id: INSTANCE_ID,
        slug: "relationship-steps",
        record_type: "assessment",
        status: "published",
        date: new Date(CREATED_AT),
        title: template.title,
        summary: "answered by Avery and Rowan",
      },
      items,
      options: [],
      instance: {
        record_id: INSTANCE_ID,
        template_record_id: template.id,
        relationship_id: RELATIONSHIP_ID,
        mode: "advanced",
        setting: "soft",
      },
      parties,
      opinions: [
        ...opinionsFor("initiator"),
        ...(answered === "both" ? opinionsFor("counterparty") : []),
      ],
      answerCounts: {
        initiator: items.length,
        counterparty: answered === "both" ? items.length : 0,
      },
    } satisfies FlowInstanceRows,
    template,
    viewerRole,
    invite: {
      email: "rowan@example.com",
      counterpartyName: "Rowan",
      expiresAt: "2026-11-30T12:00:00.000Z",
      state: "claimed" as const,
      resentAt: null,
      resentCount: 0,
      link: null,
    },
  });
}

function instanceHtml(screen: ReturnType<typeof screenOf>, stepsRead: readonly Step[]): string {
  return renderToStaticMarkup(
    createElement(AssessmentInstanceView, {
      screen,
      copy: assessmentInstancePageCopy,
      steps: stepsRead,
    }),
  );
}

describe("the Steps on the instance screen", () => {
  it("draws the plan in the report state, with a party's controls and the tick's words", () => {
    const html = instanceHtml(screenOf("both", "initiator"), [
      stepOf({ id: "step-1-a", aspectId: "aspect-a", status: "open" }),
    ]);
    expect(html).toContain("data-steps-panel");
    expect(html).toContain("data-step-toggle");
    expect(html).toContain("Steps for Improving the Relationship");
    expect(html).toContain(`action="${stepsPath(INSTANCE_ID)}"`);
  });

  it("draws no plan at all before both seats have accepted — the blind rule, one surface over", () => {
    // The page reads no Steps at all in this state; the panel is still handed rows here to prove the
    // screen — not the caller — is what keeps them off the page.
    const html = instanceHtml(screenOf("initiator-only", "initiator"), [
      stepOf({ id: "step-1-a", aspectId: "aspect-a" }),
    ]);
    expect(html).not.toContain("data-steps-panel");
    expect(html).not.toContain("Steps for Improving the Relationship");
  });

  it("shows a coach the plan and no tick", () => {
    const html = instanceHtml(screenOf("both", "coach"), [
      stepOf({ id: "step-1-a", aspectId: "aspect-a" }),
    ]);
    expect(html).toContain("data-steps-panel");
    expect(html).toContain("data-steps-read-only");
    expect(html).not.toContain("data-step-toggle");
  });
});

/* ------------------------------------------------------------------ *\
 * The write
 * ------------------------------------------------------------------ */

const written = (pattern: RegExp) =>
  stub.queries.filter((query) => pattern.test(query.text.replace(/\s+/g, " ")));

beforeEach(() => {
  stub.queries.length = 0;
  stub.session = { relationship_id: RELATIONSHIP_ID };
  stub.tokenRole = "initiator";
  stub.userRole = undefined;
  stub.itemCount = 2;
  stub.parties = [
    { role: "initiator", answered: 2, accepted: true },
    { role: "counterparty", answered: 2, accepted: true },
  ];
  stub.steps = [
    {
      id: "step-1-a",
      relationship_id: RELATIONSHIP_ID,
      aspect_id: "aspect-a",
      derived_from: ["feel"],
      suggested_text: "Suggested words",
      text: "Suggested words",
      status: "open",
      created_at: new Date(CREATED_AT),
    },
    {
      id: "step-3-b",
      relationship_id: RELATIONSHIP_ID,
      aspect_id: "aspect-b",
      derived_from: ["wish"],
      suggested_text: "Another suggestion",
      text: "Another suggestion",
      status: "closed",
      created_at: new Date(CREATED_AT),
    },
  ];
  stub.rowCount = 1;
});

const base = { instanceRecordId: INSTANCE_ID, token: "token-1" as string | undefined };

describe("a party's tick", () => {
  it("is one UPDATE, scoped by the relationship, inside one transaction", async () => {
    const result = await writeStep({ ...base, stepId: "step-1-a", patch: { status: "done" } });

    expect(result).toEqual({
      ok: true,
      changed: true,
      step: expect.objectContaining({ id: "step-1-a", status: "done" }),
    });

    const [update] = written(/^UPDATE step SET status/);
    expect(update?.values).toEqual(["step-1-a", RELATIONSHIP_ID, "done"]);
    expect(written(/^UPDATE step SET text/)).toHaveLength(0);
    expect(written(/^BEGIN$/)).toHaveLength(1);
    expect(written(/^COMMIT$/)).toHaveLength(1);
    expect(written(/^ROLLBACK$/)).toHaveLength(0);
  });

  it("writes nothing the second time — a reload is not a second state", async () => {
    const result = await writeStep({ ...base, stepId: "step-1-a", patch: { status: "done" } });
    expect(result).toMatchObject({ ok: true, changed: true });

    // Now the row already says done: the model returns the same array, so no UPDATE is issued.
    stub.steps = [{ ...stub.steps[0], status: "done" }];
    stub.queries.length = 0;
    const again = await writeStep({ ...base, stepId: "step-1-a", patch: { status: "done" } });
    expect(again).toMatchObject({ ok: true, changed: false });
    expect(written(/^UPDATE step/)).toHaveLength(0);
  });

  it("refuses a closed Step — closing is the derivation's write, never a party's", async () => {
    const result = await writeStep({ ...base, stepId: "step-3-b", patch: { status: "done" } });
    expect(result).toMatchObject({ ok: false, code: "invalid" });
    expect(written(/^UPDATE step/)).toHaveLength(0);
    expect(written(/^ROLLBACK$/)).toHaveLength(1);
  });

  it("refuses a Step that is not on this relationship", async () => {
    const result = await writeStep({
      ...base,
      stepId: "step-somebody-else",
      patch: { status: "done" },
    });
    expect(result).toMatchObject({ ok: false, code: "no-such-step" });
    expect(written(/^UPDATE step/)).toHaveLength(0);
  });
});

describe("a party's reword", () => {
  it("is one UPDATE of the text, and keeps the suggestion in the row", async () => {
    const result = await writeStep({
      ...base,
      stepId: "step-1-a",
      patch: { text: "  Talk about Sundays  " },
    });

    expect(result).toMatchObject({
      ok: true,
      changed: true,
      step: expect.objectContaining({
        text: "Talk about Sundays",
        suggestedText: "Suggested words",
      }),
    });
    const [update] = written(/^UPDATE step SET text/);
    expect(update?.values).toEqual(["step-1-a", RELATIONSHIP_ID, "Talk about Sundays"]);
  });

  it("refuses empty words — a Step with no words is not a Step", async () => {
    const result = await writeStep({ ...base, stepId: "step-1-a", patch: { text: "   " } });
    expect(result).toMatchObject({ ok: false, code: "invalid" });
    expect(written(/^UPDATE step/)).toHaveLength(0);
  });

  it("refuses a closed Step's words: they are a record, not a plan", async () => {
    const result = await writeStep({ ...base, stepId: "step-3-b", patch: { text: "new words" } });
    expect(result).toMatchObject({ ok: false, code: "invalid" });
    expect(written(/^UPDATE step/)).toHaveLength(0);
  });
});

describe("who may write, and when", () => {
  it("refuses a browser with no seat — the cookie and the account are both asked", async () => {
    stub.tokenRole = undefined;
    stub.userRole = undefined;
    const result = await writeStep({
      ...base,
      viewerUserId: "signed-in-stranger",
      stepId: "step-1-a",
      patch: { status: "done" },
    });
    expect(result).toMatchObject({ ok: false, code: "not-a-party" });
    // Both questions were asked: the token's hash, then the account's user id.
    expect(written(/access_token_hash/)).toHaveLength(1);
    expect(written(/AND user_id/)).toHaveLength(1);
    expect(written(/^UPDATE step/)).toHaveLength(0);
  });

  it("accepts a signed-in party whose cookie has gone", async () => {
    stub.tokenRole = undefined;
    stub.userRole = "counterparty";
    const result = await writeStep({
      instanceRecordId: INSTANCE_ID,
      stepId: "step-1-a",
      token: undefined,
      viewerUserId: "user-1",
      patch: { status: "done" },
    });
    expect(result).toMatchObject({ ok: true, changed: true });
  });

  it("refuses before the session is complete: the plan would name the other party's answers", async () => {
    stub.parties = [
      { role: "initiator", answered: 2, accepted: true },
      { role: "counterparty", answered: 0, accepted: false },
    ];
    const result = await writeStep({ ...base, stepId: "step-1-a", patch: { status: "done" } });
    expect(result).toMatchObject({ ok: false, code: "incomplete" });
    expect(written(/^UPDATE step/)).toHaveLength(0);
    // The Step is never even read: the refusal comes before the rows are looked at.
    expect(written(/FROM step WHERE relationship_id/)).toHaveLength(0);
  });

  it("refuses an instance that does not exist", async () => {
    stub.session = undefined;
    const result = await writeStep({ ...base, stepId: "step-1-a", patch: { status: "done" } });
    expect(result).toMatchObject({ ok: false, code: "no-such-instance" });
    expect(written(/^UPDATE step/)).toHaveLength(0);
  });
});
