/**
 * The relationship detail's two additions (#409) — the parties band, the paid band, and the read
 * that decides who is handed money at all.
 *
 * Three claims, each at the cheapest place it can be checked:
 *
 *   the read     `readRelationshipById()` asks `readFlowScreen()` for the relationship's own
 *                session (a relationship id and a session record id both resolve), and slices
 *                `paid` to the Initiator — a Counterparty's detail is `paid: null` even when the
 *                row carries a plan. The component therefore cannot draw an amount the viewer may
 *                not see: it was never handed one.
 *   the seats    the parties band names both seats, marks the seat the read resolved as `you`,
 *                says "not claimed yet" for an unclaimed Counterparty, and carries **no digit** —
 *                a name is not a fact about anybody's answers.
 *   the money    the paid band is absent when `paid` is `null`, says `—` when nothing was paid,
 *                and prints the plan and its instant otherwise. There is no sum anywhere.
 *
 * The rows are hand-built (`lib/db/rows.ts` shapes) for the reason `tests/instance-stage.test.ts`
 * gives: the component takes a projection, so every status can be driven without a database. The
 * read's half stubs `queryRows` and `readFlowScreen`, which is the same shape
 * `tests/flow-store-identity.test.ts` uses to hold the gate database-free.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssessmentInstanceView } from "@/components/assessment-flow/instance-view";
import type { Assessment } from "@/content/assessment";
import { assessments } from "@/data/assessments";
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import type { ItemRow, OpinionRow, PartyRow } from "@/lib/db/rows";
import { projectScreen, type FlowInstanceRows } from "@/lib/flow/screen";

const { queryRows, readFlowScreen } = vi.hoisted(() => ({
  queryRows: vi.fn(),
  readFlowScreen: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ queryRows }));
vi.mock("@/lib/flow/store", () => ({ readFlowScreen }));

import { readRelationshipById } from "@/lib/db/assessments";

const template: Assessment = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("the relationship-detail test's template is missing");
  return found;
})();

const INSTANCE_ID = "instance-detail-test";

const items: ItemRow[] = template.items.map((item, position) => ({
  record_id: INSTANCE_ID,
  item_id: item.id,
  position,
  prompt: item.prompt,
  scale_kind: "score",
  left_value: item.leftValue,
  right_value: item.rightValue,
}));

function answeredBy(role: "initiator" | "counterparty"): OpinionRow[] {
  return items.map((item) => ({
    session_record_id: INSTANCE_ID,
    role,
    item_id: item.item_id,
    feel: 3,
    wish: 4,
    think: null,
    guess: null,
  }));
}

const bothParties: PartyRow[] = [
  { session_record_id: INSTANCE_ID, role: "initiator", name: "Avery" },
  { session_record_id: INSTANCE_ID, role: "counterparty", name: "Rowan" },
];

function rowsWith(parties: readonly PartyRow[], opinions: readonly OpinionRow[]): FlowInstanceRows {
  return {
    record: {
      id: INSTANCE_ID,
      slug: "detail-test",
      record_type: "assessment",
      status: "draft",
      date: new Date("2026-10-30T12:00:00.000Z"),
      title: template.title,
      summary: "answered by Avery and Rowan",
    },
    items,
    options: [],
    instance: {
      record_id: INSTANCE_ID,
      template_record_id: template.id,
      relationship_id: "relationship-detail-test",
      mode: "basic",
      setting: "soft",
    },
    parties,
    opinions,
    answerCounts: {
      initiator: opinions.filter((opinion) => opinion.role === "initiator").length,
      counterparty: opinions.filter((opinion) => opinion.role === "counterparty").length,
    },
  };
}

/** Half answered: the viewer's own sheet only, which is the state the blind rule is about. */
const halfAnswered = rowsWith(bothParties, answeredBy("initiator"));

/** Both submitted — the report is open and the parties band is unchanged. */
const complete = rowsWith(bothParties, [...answeredBy("initiator"), ...answeredBy("counterparty")]);

/** The Initiator invited somebody who has not claimed: there is no Counterparty party row. */
const invited = rowsWith([bothParties[0]], []);

function render(
  rows: FlowInstanceRows,
  paid: Parameters<typeof AssessmentInstanceView>[0]["paid"] = null,
): string {
  const screen = projectScreen({ rows, template, viewerRole: "initiator", invite: null });
  return renderToStaticMarkup(
    createElement(AssessmentInstanceView, { screen, copy: assessmentInstancePageCopy, paid }),
  );
}

/** One `<li data-party="…">` block, as raw markup. */
function seat(html: string, role: "initiator" | "counterparty"): string {
  const match = html.match(new RegExp(`<li data-party="${role}"[\\s\\S]*?</li>`));
  if (match === null) throw new Error(`the ${role} seat did not render`);
  return match[0];
}

describe("the read slices money to the Initiator", () => {
  const relationshipRow = {
    relationship_id: "relationship-detail-test",
    session_record_id: INSTANCE_ID,
    plan: "household",
    purchased_at: new Date("2026-10-20T12:00:00.000Z"),
  };

  const screenFor = (role: "initiator" | "counterparty" | "coach") =>
    projectScreen({
      rows: role === "coach" ? halfAnswered : complete,
      template,
      viewerRole: role,
      invite: null,
    });

  beforeEach(() => {
    vi.clearAllMocks();
    queryRows.mockResolvedValue([relationshipRow]);
  });

  it("resolves a relationship id (or a session record id) and reads that session's screen", async () => {
    readFlowScreen.mockResolvedValue(screenFor("initiator"));

    const detail = await readRelationshipById("relationship-detail-test", {
      viewerUserId: "user-avery",
    });

    expect(readFlowScreen).toHaveBeenCalledWith(
      expect.objectContaining({ instanceRecordId: INSTANCE_ID, viewerUserId: "user-avery" }),
    );
    expect(detail?.relationshipId).toBe("relationship-detail-test");
    expect(detail?.instanceRecordId).toBe(INSTANCE_ID);
    expect(detail?.paid).toEqual({
      plan: "household",
      purchasedAt: "2026-10-20T12:00:00.000Z",
    });
  });

  it("hands a Counterparty `null` even though the row carries a plan", async () => {
    readFlowScreen.mockResolvedValue(screenFor("counterparty"));

    const detail = await readRelationshipById(INSTANCE_ID, { viewerUserId: "user-rowan" });

    expect(detail?.paid).toBeNull();
  });

  it("hands a coach `null` too — a coach reads the relationship, not its billing", async () => {
    readFlowScreen.mockResolvedValue(screenFor("coach"));

    const detail = await readRelationshipById(INSTANCE_ID, { viewerUserId: "user-coach" });

    expect(detail?.paid).toBeNull();
  });

  it("answers `undefined` for an id that names no relationship, without reading a screen", async () => {
    queryRows.mockResolvedValue([]);

    await expect(readRelationshipById("nope", { viewerUserId: "u" })).resolves.toBeUndefined();
    expect(readFlowScreen).not.toHaveBeenCalled();
  });
});

describe("the parties band", () => {
  it("names both seats and marks the one this request answers as", () => {
    const html = render(halfAnswered);

    expect(html).toContain('data-parties="true"');
    expect(seat(html, "initiator")).toContain("Avery");
    expect(seat(html, "counterparty")).toContain("Rowan");
    // `you` is the seat the read resolved — exactly one seat is marked on any screen.
    expect(seat(html, "initiator")).toContain("you");
    expect(seat(html, "counterparty")).not.toContain("you");
  });

  it("says the Counterparty has not claimed the seat rather than leaving it blank", () => {
    const html = render(invited);

    expect(seat(html, "counterparty")).toContain("Not claimed yet");
  });

  it("carries no number at all — a seat's name is not a fact about its answers", () => {
    const band = render(halfAnswered).match(/<section data-parties="true"[\s\S]*?<\/section>/)?.[0];
    expect(band).toBeDefined();
    // Text only: a class name (`p-4`, `text-sm`) is not a figure a reader sees.
    const text = (band ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    expect(text).not.toMatch(/\d/);
  });
});

describe("the paid band", () => {
  it("is absent when the read handed the viewer nothing", () => {
    expect(render(complete, null)).not.toContain('data-paid="true"');
  });

  it("says `—` when nothing has been paid, never `0` and never a total", () => {
    const html = render(complete, { plan: null, purchasedAt: null });
    const band = html.match(/<section data-paid="true"[\s\S]*?<\/section>/)?.[0] ?? "";

    expect(band).not.toBe("");
    expect(band).toContain("—");
    expect(band).toContain("Nothing has been paid on this relationship.");
    expect(band).not.toMatch(/total/i);
    expect(band).not.toMatch(/£|\$|€/);
  });

  it("prints the plan and the instant it was bought — two facts, no arithmetic", () => {
    const html = render(complete, {
      plan: "household",
      purchasedAt: "2026-10-20T12:00:00.000Z",
    });
    const band = html.match(/<section data-paid="true"[\s\S]*?<\/section>/)?.[0] ?? "";

    expect(band).toContain("household");
    expect(band).toContain("Oct 20, 2026");
    expect(band).not.toContain("—");
  });
});

/* ------------------------------------------------------------------ *
 * #t_e9212bf9 — the payment door
 * ------------------------------------------------------------------ */

/** The relationship row as the page's statement returns it, with the door's facts beside it. */
const doorRow = {
  relationship_id: "relationship-detail-test",
  session_record_id: INSTANCE_ID,
  plan: null,
  purchased_at: null,
  payer_user_id: "user-avery",
  method_captured_at: null,
  charge_due_at: null,
  payment_charged_at: null,
  charge_attempts: 0,
  first_failed_at: null,
  payment_expired_at: null,
  charge_amount_cents: null,
  sealed_at: new Date("2026-11-01T12:00:00.000Z"),
  accepted_count: 2,
};

describe("the payment door is sliced to its payer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryRows.mockResolvedValue([doorRow]);
    readFlowScreen.mockResolvedValue(
      projectScreen({ rows: complete, template, viewerRole: "initiator", invite: null }),
    );
  });

  it("hands the payer a door: no method, sealed, and the fee the server will charge", async () => {
    const detail = await readRelationshipById(INSTANCE_ID, { viewerUserId: "user-avery" });

    expect(detail?.payment).not.toBeNull();
    expect(detail?.payment?.phase).toBe("none");
    expect(detail?.payment?.refusal).toBe("method-required");
    expect(detail?.payment?.canComplete).toBe(false);
    expect(detail?.payment?.amountCents).toBe(895);
    expect(detail?.payment?.chargeDueAt).toBeNull();
  });

  it("states the stored charge_due_at once a method is on file", async () => {
    queryRows.mockResolvedValue([
      {
        ...doorRow,
        method_captured_at: new Date("2026-11-03T09:30:00.000Z"),
        charge_due_at: new Date("2026-11-10T09:30:00.000Z"),
      },
    ]);

    const detail = await readRelationshipById(INSTANCE_ID, { viewerUserId: "user-avery" });

    expect(detail?.payment?.chargeDueAt).toBe("2026-11-10T09:30:00.000Z");
    expect(detail?.payment?.canComplete).toBe(true);
  });

  it("hands the counterparty `null`, though the obligation names the payer (ADR-8)", async () => {
    const detail = await readRelationshipById(INSTANCE_ID, { viewerUserId: "user-rowan" });

    expect(detail?.payment).toBeNull();
  });

  it("hands a cookie-only reader `null` — no account, no billing", async () => {
    const detail = await readRelationshipById(INSTANCE_ID, { viewerUserId: null });

    expect(detail?.payment).toBeNull();
  });
});

describe("the payment band on the assessment", () => {
  /**
   * Both sealed, the fee outstanding — the state the stage sentence could name and not leave.
   *
   * `status` is set here rather than derived: `projectScreen` decides it from the party rows this
   * fixture does not populate with acceptance instants, and `instanceStatusOf()`'s own mapping is
   * pinned by `tests/flow-state`-family cases. What this file is about is which band the status
   * draws — and that the counterparty's carries no money.
   */
  const sealedUnpaid = (viewerRole: "initiator" | "counterparty") => ({
    ...projectScreen({ rows: complete, template, viewerRole, invite: null }),
    status: "awaiting_payment" as const,
  });

  function band(html: string): string {
    return html.match(/<section data-payment-door="[^"]*"[\s\S]*?<\/section>/)?.[0] ?? "";
  }

  it("is the way to the relationship's Payment band for the payer", () => {
    const html = renderToStaticMarkup(
      createElement(AssessmentInstanceView, {
        screen: sealedUnpaid("initiator"),
        copy: assessmentInstancePageCopy,
        relationshipId: "relationship-detail-test",
        paymentDoor: true,
      }),
    );

    expect(html).toContain('data-payment-door="payer"');
    expect(band(html)).toContain('href="/dashboard/relationships/relationship-detail-test"');
    expect(band(html)).toContain("Activate Relationship");
  });

  it("says the waiting sentence and carries no amount for the counterparty", () => {
    const html = renderToStaticMarkup(
      createElement(AssessmentInstanceView, {
        screen: sealedUnpaid("counterparty"),
        copy: assessmentInstancePageCopy,
        relationshipId: "relationship-detail-test",
        // The read hands a counterparty `payment: null`, which is what this flag is derived from.
        paymentDoor: false,
      }),
    );

    expect(html).toContain('data-payment-door="counterparty"');
    expect(band(html)).toContain("Waiting for Avery to publish.");
    expect(band(html)).not.toContain("/dashboard/relationships/");
    expect(band(html)).not.toMatch(/\$\d/);
  });

  it("is not drawn before the sheets are sealed or after the fee landed", () => {
    for (const rows of [halfAnswered, complete]) {
      const html = renderToStaticMarkup(
        createElement(AssessmentInstanceView, {
          screen: projectScreen({ rows, template, viewerRole: "initiator", invite: null }),
          copy: assessmentInstancePageCopy,
          relationshipId: "relationship-detail-test",
          paymentDoor: true,
        }),
      );
      expect(html).not.toContain("data-payment-door");
    }
  });
});
