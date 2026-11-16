/**
 * The demo's **admin half** is authored data, and these are the properties that make it safe to
 * seed (#1081).
 *
 * The rows themselves live in `scripts/db-seed-admin-surfaces.mjs`, because `scripts/db-seed.mjs`
 * runs its seed at import and nothing inside it can be tested. What is asserted here is the part a
 * reviewer cannot check by reading one screen:
 *
 *   1. **the expectation file's numbers are the plan's numbers** — `data/verify/demo-expectations.json`
 *      is what `pnpm demo:verify` diffs the branch against, so a count typed beside the loop that
 *      writes it is the defect #1091 already paid for;
 *   2. **no row points at a row that does not exist** — every id the plan references is one of the
 *      anchors it was handed, and an audit entry naming anything else is refused rather than
 *      rendered as a 404 from `/admin/audit`;
 *   3. **the vocabularies are the product's** — an audit `action` is in `ADMIN_ACTIONS` and a
 *      `target_table` in `AUDIT_TARGET_TABLES`, a message `status` is one of the four the inbox
 *      draws, and a reply's `state` carries the instant or the error its own CHECK requires;
 *   4. **the anchors the seed reads actually exist in the dataset** — the queries pick an `active`
 *      and a `complete` relationship that carry a plan and a bound initiator, so a population that
 *      stops carrying one fails here rather than at seed time on a shared branch;
 *   5. **every instant is on the fixture clock** — `DEMO_NOW_ISO` plus or minus whole periods, never
 *      a wall clock read at render time (`#418`).
 *
 * What this file cannot see is the branch: whether the rows landed, and whether the five screens
 * draw them. That is `pnpm db:seed` + `pnpm demo:verify`, and the five signed-in 200s the card's
 * acceptance names.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { zAssessmentSession, seededLifecycleOf } from "@/content/assessment";
import { DEMO_NOW_ISO } from "@/content/core";
import { billingPlan, planPriceCents } from "@/data/billing-plans";
import { ADMIN_ACTIONS, AUDIT_TARGET_TABLES } from "@/lib/admin/roles";
import {
  ADMIN_SURFACE_ROWS,
  adminSurfacePlan,
  assertReferences,
  shiftIso,
  stableId,
} from "../scripts/db-seed-admin-surfaces.mjs";

const EXPECTATIONS_PATH = new URL("../data/verify/demo-expectations.json", import.meta.url);
const BUNDLE_PATH = new URL("../data/bundles/demo-dataset.alignsynch.json", import.meta.url);

interface Expectations {
  readonly rows: Record<string, number>;
}

interface DatasetBundle {
  readonly payload: { readonly instances: unknown[] };
}

const expectations = JSON.parse(readFileSync(EXPECTATIONS_PATH, "utf8")) as Expectations;
const bundle = JSON.parse(readFileSync(BUNDLE_PATH, "utf8")) as DatasetBundle;
const bundleSessions = zAssessmentSession.array().parse(bundle.payload.instances);

/** The tier both anchors carry in the committed dataset, read from the fixture rather than typed. */
const GRANTED_SESSION_ID = "assessment-instance-avery-rowan-flat";
const PAID_SESSION_ID = "assessment-instance-avery-rowan-summer";
const ARTIFACT_ID = "review-relationship-lifecycle-v9";
const ADMIN_USER_ID = "b6b7d0d1-3a3e-4b0e-9d5f-2f6f3f6f0001";
const INITIATOR_USER_ID = "b6b7d0d1-3a3e-4b0e-9d5f-2f6f3f6f0002";

const grantedSession = bundleSessions.find((session) => session.id === GRANTED_SESSION_ID);
const paidSession = bundleSessions.find((session) => session.id === PAID_SESSION_ID);

const grantedPlan =
  grantedSession === undefined ? undefined : seededLifecycleOf(grantedSession).plan;
const paidPlan = paidSession === undefined ? undefined : seededLifecycleOf(paidSession).plan;
const paidTier = billingPlan(paidPlan ?? "");

/**
 * The anchors, as `readAnchors()` hands them over — the same ids the branch's rows carry, because
 * `data:check` E32 holds the bundle equal to the fixtures the seed writes.
 */
const anchors = {
  nowIso: DEMO_NOW_ISO,
  adminUserId: ADMIN_USER_ID,
  granted: {
    relationshipId: `relationship-${GRANTED_SESSION_ID}`,
    planId: grantedPlan,
    sessionRecordId: GRANTED_SESSION_ID,
    createdAtIso: "2026-10-21T03:00:00.000Z",
  },
  paid: {
    relationshipId: `relationship-${PAID_SESSION_ID}`,
    planId: paidPlan,
    sessionRecordId: PAID_SESSION_ID,
    initiatorUserId: INITIATOR_USER_ID,
    priceCents: paidTier === undefined ? 0 : planPriceCents(paidTier, "month"),
    createdAtIso: "2026-09-28T03:00:00.000Z",
  },
  artifact: { id: ARTIFACT_ID },
};

const plan = adminSurfacePlan(anchors);

/** Every instant the plan authors, as ISO strings, wherever it appears. */
function instantsOf(value: unknown, found: string[] = []): string[] {
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) found.push(value);
    return found;
  }
  if (Array.isArray(value)) {
    for (const entry of value) instantsOf(entry, found);
    return found;
  }
  if (typeof value === "object" && value !== null && !(value instanceof Set)) {
    for (const entry of Object.values(value)) instantsOf(entry, found);
  }
  return found;
}

describe("the demo's admin half", () => {
  it("records the row counts the plan actually authors, not a number typed beside it", () => {
    // The one assertion the expectation file exists for: change the plan, and the file has to move
    // in the same diff. `pnpm demo:verify` then diffs the branch against these numbers.
    for (const [table, count] of Object.entries(ADMIN_SURFACE_ROWS)) {
      expect(expectations.rows[table], `data/verify/demo-expectations.json rows.${table}`).toBe(
        count,
      );
    }
    // And the plan agrees with itself: `adminSurfacePlan` refuses when its rows and the table say
    // different things, so a mismatch above would already have thrown.
    expect(plan.audit).toHaveLength(6);
    expect(Object.keys(ADMIN_SURFACE_ROWS)).toHaveLength(13);
  });

  it("references only rows the seed creates: the anchors, and ids derived from them", () => {
    const relationshipIds = new Set([anchors.granted.relationshipId, anchors.paid.relationshipId]);
    const sessionIds = new Set([anchors.granted.sessionRecordId, anchors.paid.sessionRecordId]);

    for (const grant of plan.grants) expect(relationshipIds).toContain(grant.relationshipId);
    for (const payment of plan.payments) {
      expect(relationshipIds).toContain(payment.relationshipId);
      expect(payment.payerUserId).toBe(INITIATOR_USER_ID);
    }
    for (const todo of plan.todos) expect(todo.artifactId).toBe(ARTIFACT_ID);
    for (const issue of plan.issues) expect(issue.artifactId).toBe(ARTIFACT_ID);
    // Every author column is an account this run created.
    for (const row of plan.audit) {
      expect([ADMIN_USER_ID, INITIATOR_USER_ID]).toContain(row.actorUserId);
    }
    for (const row of [...plan.replies, ...plan.issues, ...plan.todos, ...plan.comments]) {
      expect([ADMIN_USER_ID, INITIATOR_USER_ID]).toContain(row.authorUserId);
    }
    // The audit entries are the interesting half: each one names the row it describes.
    for (const row of plan.audit) {
      if (row.targetTable === "session") expect(sessionIds).toContain(row.targetId);
      if (row.targetTable === "relationship") expect(relationshipIds).toContain(row.targetId);
    }
    // Nothing may point at a session that is not one of the two anchors.
    for (const id of plan.knownTargets.session) expect(sessionIds).toContain(id);
  });

  it("refuses an audit entry that would dangle, rather than seeding a 404", () => {
    // The negative case. A plan whose known-target set has lost the grant must not be writable —
    // this is the check the card asks for ("assert it in the seed or a test"), and it has to fail
    // on the value, not merely on the shape.
    const dangling = {
      ...plan,
      audit: [
        plan.audit[0],
        {
          ...plan.audit[1],
          targetTable: "plan_grant",
          targetId: stableId("plan-grant", "a-grant-nobody-wrote"),
        },
      ],
    };
    expect(() => assertReferences(dangling)).toThrow(/does not create/);

    // And an audit row naming a table this seed writes no row for at all.
    expect(() =>
      assertReferences({ ...plan, audit: [{ ...plan.audit[0], targetTable: "party" }] }),
    ).toThrow(/writes no row for/);
  });

  it("uses the product's own vocabularies: admin actions, target tables, triage statuses", () => {
    for (const row of plan.audit) {
      expect(ADMIN_ACTIONS).toContain(row.action);
      expect(AUDIT_TARGET_TABLES).toContain(row.targetTable);
      // `support` is the floor of every action authored here (`message.*`, `review.issue`,
      // `broadcast.send`, `plan.comp`, `report.regenerate`), so the rung the log records is one
      // that could actually have taken them.
      expect(["admin", "owner"]).toContain(row.actorRole);
    }
    for (const message of plan.messages) {
      expect(["new", "open", "waiting", "closed"]).toContain(message.status);
      // 0028's pairing: a seat and the instant it was taken are one fact.
      expect(message.assignedUserId === null).toBe(message.assignedAt === null);
    }
    for (const reply of plan.replies) {
      expect(["sending", "sent", "failed"]).toContain(reply.state);
      // `contact_reply_sent_has_instant` and `contact_reply_failed_has_error`, stated as assertions.
      expect(reply.state === "sent").toBe(reply.sentAt !== null);
      if (reply.state === "failed") expect(reply.error).toBeTruthy();
    }
    for (const issue of plan.issues) {
      expect(["open", "closed"]).toContain(issue.state);
      // `review_issue_state_pair`.
      expect(issue.state === "closed").toBe(issue.closedAt !== null);
    }
    // A message that was answered carries the instant the provider accepted; an unanswered one
    // carries none. This is what the inbox row reads to say "replied".
    const answered = plan.messages.find((message) => message.status === "open");
    expect(answered?.sentAt).not.toBeNull();
    expect(plan.messages.find((message) => message.status === "new")?.sentAt).toBeNull();
  });

  it("draws its anchors from relationships the dataset actually carries", () => {
    // `readAnchors()` picks an `active` and a `complete` relationship that carry a plan and are
    // bound to a demo identity. If the population stops carrying one, the seed refuses on a shared
    // branch; this fails first, by name.
    expect(grantedSession, `the bundle must carry ${GRANTED_SESSION_ID}`).toBeDefined();
    expect(paidSession, `the bundle must carry ${PAID_SESSION_ID}`).toBeDefined();
    expect(seededLifecycleOf(grantedSession!).status).toBe("active");
    expect(seededLifecycleOf(paidSession!).status).toBe("complete");
    // A plan on the relationship is what makes a comp and a charge meaningful; a tierless row
    // would have the seed grant or bill a plan the relationship does not carry.
    expect(grantedPlan).toBeTruthy();
    expect(paidPlan).toBeTruthy();
    expect(paidTier, `billing_plan must carry the tier "${paidPlan}"`).toBeDefined();
    expect(anchors.paid.priceCents).toBeGreaterThan(0);
  });

  it("is deterministic: two runs author the same rows with the same ids", () => {
    // A random id would stack a second console on every `demo:reset`, and the audit row that names
    // a message would stop resolving to the row it describes.
    expect(adminSurfacePlan(anchors)).toEqual(plan);
    const ids = [
      ...plan.messages.map((row) => row.id),
      ...plan.replies.map((row) => row.id),
      ...plan.audit.map((row) => row.id),
      ...plan.issues.map((row) => row.id),
      ...plan.todos.map((row) => row.id),
      ...plan.comments.map((row) => row.id),
      ...plan.grants.map((row) => row.id),
      ...plan.broadcastSends.map((row) => row.id),
    ];
    // Unique, and uuid-shaped: the columns are `uuid`, and a reader may quote one.
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
    }
    // The anchor relationship ids are the dataset's, so a re-seed of a changed population cannot
    // keep pointing at the old one.
    expect(stableId("contact-message", "open-thread")).toBe(plan.messages[0].id);
  });

  it("stamps every instant on the fixture clock, never on a wall clock", () => {
    const now = Date.parse(DEMO_NOW_ISO);
    const instants = instantsOf(plan);
    expect(instants.length).toBeGreaterThan(10);
    for (const iso of instants) {
      const at = Date.parse(iso);
      expect(Number.isNaN(at)).toBe(false);
      // Whole minutes from the fixture clock, and inside the demo's own window — a `new Date()`
      // read in this file would land weeks away from `DEMO_NOW_ISO` and fail here.
      expect(Math.abs(at - now) % 60_000).toBe(0);
      expect(Math.abs(at - now)).toBeLessThan(120 * 24 * 60 * 60 * 1000);
    }
    // The one instant that is not `now ± n` is a relationship's own creation, which the seed reads
    // from the row rather than recomputing.
    expect(shiftIso(DEMO_NOW_ISO, { days: -1 })).toBe("2026-10-28T12:00:00.000Z");
  });
});
