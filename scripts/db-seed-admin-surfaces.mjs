/**
 * The **admin half** of the demo (#1081) — the six console surfaces that read empty on a fresh
 * dataset: `/admin/audit`, `/admin/inbox`, `/admin/broadcast`, `/admin/billing` and `/admin/review`,
 * plus the news list the broadcast screen's reach is measured on.
 *
 * **Why this exists.** #1079 gave the demo thirty-one relationships across all seven lifecycle
 * statuses, and a walkthrough that signs in as the Admin then sees the console's rail of empty
 * lists. A rail where two entries work and four are empty reads as unfinished, which is the
 * opposite of what a demo is for. This file authors the rows those lists read.
 *
 * **Every row names a row that exists.** Ids are not typed anywhere in this file: the anchors (a
 * relationship on an `active` plan, a `complete` one whose fee the demo half charged, its session,
 * the newest review artifact, the Admin's own account) are **read from the branch inside the seed's
 * own transaction**, so a row cannot point at a record the seed did not create — and
 * `adminSurfacePlan()` builds a `knownTargets` set from exactly those ids and their children, so an
 * audit row that named anything else throws before a single statement runs. A dangling reference
 * renders a 404 from an admin list, which is worse than the empty state it replaced.
 *
 * **The rows converge; a second run never stacks.** Every id is derived (`stableId`) from a string
 * this file owns, and every insert is an upsert on its own key, so run two writes the same rows with
 * the same ids and the same counts. That matters more than usual here: `demo:reset --skip-reset`
 * empties the content tables and **not** these (`scripts/demo-reset.mjs::resetContent`), so the
 * console's rows survive a reseed and the next seed has to land on top of them.
 *
 * **The clock is the fixture's, never `now()`.** Every instant is `DEMO_NOW_ISO` plus or minus whole
 * days and hours (`content/core.ts`), for the reason `AGENTS.md` records: a relative label computed
 * from a wall clock is rendered once by the server and again at hydration, and the two disagree
 * (#418). The dataset's own instants are on the same clock, so the audit row describing a repair
 * carries the same day as the row it repaired.
 *
 * **Auth user ids are rewritten on every run, on purpose.** `seedDemoAccounts` creates the three
 * demo identities through the branch's own sign-up endpoint, so each run mints **new** uuids. A row
 * that recorded `actor_user_id` once would point at an auth user the next run deleted, and
 * `/admin/audit` would print a bare uuid instead of `admin@demo.alignsynch.test`. That is why the
 * upserts update the account columns rather than `DO NOTHING`: the log is append-only in the
 * *product*, and a seed re-installs the same six facts against the identities it just created.
 *
 * **Gated to the demo path.** `scripts/db-seed.mjs` calls this only under `DEMO_AUTH=1`, the same
 * switch that gates the three accounts, so production's seed never writes a synthetic audit row,
 * contact message or broadcast (`#1081`'s constraint). Nothing here adds a table, a column or a
 * CHECK: if a surface ever needs data this model cannot express, that is a model question, not a
 * seed question.
 *
 * **Why this lives in its own module.** `scripts/db-seed.mjs` runs its seed at import, so nothing
 * left inside it can be tested — the reason `db-seed-subscriptions.mjs`, `db-seed-invite.mjs`,
 * `db-seed-sweep.mjs` and `db-seed-lock.mjs` exist. `tests/db-seed-admin-surfaces.test.ts` drives
 * the pure half: the rows it authors, the ids it references, and the counts the expectation file
 * carries.
 */
import { createHash } from "node:crypto";

/* ------------------------------------------------------------------ *
 * Ids, clock, and the shape of what is written
 * ------------------------------------------------------------------ */

/** The one namespace every derived id comes from — changing it re-ids the whole demo admin half. */
const ID_NAMESPACE = "algn/admin-surface";

/**
 * A deterministic uuid from a stable string.
 *
 * `randomUUID()` would make a second run insert a *second* row wherever the natural key is not the
 * id (a `contact_message`, an audit row), and the demo would grow a duplicate console every reset.
 * A digest of this file's own name for the row does not: `stableId("contact-message", "open-thread")`
 * is the same uuid on every machine and every run, so the upsert converges and the audit row that
 * names it keeps pointing at it. Shaped as an RFC 4122 variant-4 uuid because the columns are
 * `uuid` and a reader may quote one.
 */
export function stableId(kind, key) {
  const digest = createHash("sha256").update(`${ID_NAMESPACE}/${kind}/${key}`).digest("hex");
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(13, 16)}`,
    `a${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join("-");
}

/** A content digest, lowercase hex — the `broadcast_send.body_hash` shape. */
function digestOf(text) {
  return createHash("sha256").update(text).digest("hex");
}

/** `nowIso` shifted by whole days and hours. Never `new Date()` — see the module docstring. */
export function shiftIso(nowIso, { days = 0, hours = 0 } = {}) {
  const base = Date.parse(nowIso);
  if (Number.isNaN(base)) throw new Error(`shiftIso: "${nowIso}" is not an instant`);
  return new Date(base + (days * 24 + hours) * 60 * 60 * 1000).toISOString();
}

/**
 * The row counts this seed authors, in the terms `data/verify/demo-expectations.json` records them.
 *
 * Exported so the file cannot carry a second copy of the numbers: the seed prints these, the
 * expectation file is held equal to them by `tests/db-seed-admin-surfaces.test.ts`, and
 * `scripts/demo-verify.mjs` counts the same tables on the branch.
 */
export const ADMIN_SURFACE_ROWS = {
  admin_action: 6,
  billing_event: 2,
  broadcast_recipient: 3,
  broadcast_send: 1,
  contact_message: 3,
  contact_reply: 2,
  email_event: 2,
  news_signup: 5,
  plan_grant: 1,
  review_issue: 2,
  review_issue_comment: 2,
  review_todo: 3,
};

/** The count of every table above, for `scripts/demo-verify.mjs`'s data half. One home. */
export const ADMIN_SURFACE_COUNT_SQL = Object.fromEntries(
  Object.keys(ADMIN_SURFACE_ROWS).map((table) => [
    table,
    `SELECT count(*)::int AS n FROM ${table}`,
  ]),
);

/** The five addresses the news list is made of — RFC 6761's `.test` cannot route anywhere. */
const NEWS_ADDRESSES = [
  { email: "ada@demo.alignsynch.test", source: "/help", days: 62 },
  { email: "milo@demo.alignsynch.test", source: "/help", days: 44 },
  { email: "priya@demo.alignsynch.test", source: "/", days: 31 },
  { email: "tomas@demo.alignsynch.test", source: "/pricing", days: 16 },
  { email: "walt@demo.alignsynch.test", source: "/", days: 9 },
];

/** The one address that asked not to be mailed again, and the one the provider bounced. */
const UNSUBSCRIBED = "walt@demo.alignsynch.test";
const BOUNCED = "tomas@demo.alignsynch.test";

/* ------------------------------------------------------------------ *
 * The plan — pure, from anchors the seed has already written
 * ------------------------------------------------------------------ */

/**
 * The rows, as values, from the ids the seed just installed.
 *
 * `anchors` is the whole of what this function is allowed to point at:
 *
 *   - `granted`  an `active` relationship carrying a plan, bound to the demo initiator, with its
 *                session and its creation instant — the relationship the comp is given to.
 *   - `paid`     a `complete` relationship carrying a plan, bound to the demo initiator — the one
 *                that was charged. `priceCents` is the `billing_plan` row for its tier and interval,
 *                so the amount is the price a checkout charges rather than a number typed here.
 *   - `artifact` the newest review artifact by `captured_at`, which is the one `/admin/review` opens
 *                when no `?artifact=` is given — so the issues and to-dos are visible on arrival.
 *   - `adminUserId` the `admin@demo.alignsynch.test` auth user this run created.
 *
 * Every id a row carries that is *not* one of these is a child this file creates itself (`stableId`),
 * and the result carries `knownTargets` — the set an audit row's `(target_table, target_id)` must be
 * in. A caller that hands this function an anchor with no session, no plan or no price gets a
 * refusal, never a row with a hole in it.
 */
export function adminSurfacePlan(anchors) {
  const { nowIso, adminUserId, granted, paid, artifact } = anchors;

  for (const [name, value] of Object.entries({
    nowIso,
    adminUserId,
    granted: granted?.relationshipId,
    paid: paid?.relationshipId,
    artifact: artifact?.id,
  })) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(
        `the admin half needs ${name}, and the seed could not read one from the branch — ` +
          "the dataset this file is written against is not what the branch holds",
      );
    }
  }
  for (const [name, anchor] of Object.entries({ granted, paid })) {
    if (typeof anchor.sessionRecordId !== "string" || anchor.sessionRecordId === "") {
      throw new Error(
        `the admin half needs a session on the ${name} relationship, and there is none`,
      );
    }
    if (typeof anchor.planId !== "string" || anchor.planId === "") {
      throw new Error(`the admin half needs a tier on the ${name} relationship, and there is none`);
    }
  }
  if (!Number.isInteger(paid.priceCents) || paid.priceCents <= 0) {
    throw new Error(
      `billing_plan carries no positive month price for "${paid.planId}" — the paid relationship's ` +
        "row would have to invent an amount, and an amount is the one thing this file will not type",
    );
  }

  /* --- the ids every later row points at ------------------------------------------------ */
  const ids = {
    // The news list and the one send.
    broadcast: stableId("broadcast-send", "monthly-notice"),
    // The inbox.
    openMessage: stableId("contact-message", "open-thread"),
    waitingMessage: stableId("contact-message", "waiting-thread"),
    newMessage: stableId("contact-message", "new-thread"),
    sentReply: stableId("contact-reply", "open-thread/accepted"),
    failedReply: stableId("contact-reply", "waiting-thread/refused"),
    // Billing.
    grant: stableId("plan-grant", `${granted.relationshipId}/${granted.planId}`),
    // The review shelf.
    openIssue: stableId("review-issue", `${artifact.id}#1`),
    closedIssue: stableId("review-issue", `${artifact.id}#2`),
    issueComment: stableId("review-comment", `${artifact.id}#1/confirmed`),
    issueReply: stableId("review-comment", `${artifact.id}#2/fixed`),
    todoOpen: stableId("review-todo", `${artifact.id}/field-inventory`),
    todoDone: stableId("review-todo", `${artifact.id}/empty-state`),
    todoLater: stableId("review-todo", `${artifact.id}/lapse-band`),
  };

  /* --- the news list, and what the send left ---------------------------------------------- */
  const newsSignups = NEWS_ADDRESSES.map((entry) => ({
    email: entry.email,
    source: entry.source,
    createdAt: shiftIso(nowIso, { days: -entry.days }),
    unsubscribedAt: entry.email === UNSUBSCRIBED ? shiftIso(nowIso, { days: -3 }) : null,
    bouncedAt: entry.email === BOUNCED ? shiftIso(nowIso, { days: -6 }) : null,
    complainedAt: null,
  }));

  const sendInstant = shiftIso(nowIso, { days: -8, hours: -2 });
  const consented = newsSignups.filter(
    (row) => row.unsubscribedAt === null && row.bouncedAt === null && row.complainedAt === null,
  );

  const broadcastSends = [
    {
      id: ids.broadcast,
      actorUserId: adminUserId,
      segment: "all",
      segmentSince: null,
      // The body is never stored — 0028 keeps its digest beside the count and the segment.
      bodyHash: digestOf(
        "Gap reports now open in a second tab, and a relationship's trial starts when it is sent.",
      ),
      subject: "Two changes to how AlignSynch reads a Gap",
      recipientCount: consented.length,
      // `captured`, not `live`: no mailbox received this notice. The column's two words are the
      // deployment's mail mode, and claiming `live` would say a synthetic send reached five people.
      keyMode: "captured",
      createdAt: sendInstant,
    },
  ];
  const broadcastRecipients = consented.map((row) => ({
    broadcastId: ids.broadcast,
    email: row.email,
    createdAt: sendInstant,
  }));

  /*
   * The provider's verdict on two addresses — the inbox reads these to decide whether a reply may
   * be sent at all (`lib/admin/inbox.ts::deliveryStateOf`). One is the hard bounce the broadcast
   * hit; the other is a delivery that landed, so a row can be drawn with a state other than
   * "unknown". `payload.data.bounce.type` is the only place hardness is read from.
   */
  const emailEvents = [
    {
      providerEventId: "demo-delivery-bounced-1",
      type: "email.bounced",
      recipient: BOUNCED,
      subject: "Two changes to how AlignSynch reads a Gap",
      occurredAt: shiftIso(nowIso, { days: -6 }),
      payload: { type: "email.bounced", data: { to: [BOUNCED], bounce: { type: "Permanent" } } },
    },
    {
      providerEventId: "demo-delivery-delivered-1",
      type: "email.delivered",
      recipient: newsSignups[0].email,
      subject: "Two changes to how AlignSynch reads a Gap",
      occurredAt: shiftIso(nowIso, { days: -8, hours: -2 }),
      payload: { type: "email.delivered", data: { to: [newsSignups[0].email] } },
    },
  ];

  /* --- the inbox: a worked thread, a refused reply, and an untouched queue row ------------ */
  const assignedAt = shiftIso(nowIso, { hours: -26 });
  const replyAt = shiftIso(nowIso, { hours: -24 });
  const waitingAssignedAt = shiftIso(nowIso, { hours: -20 });

  const messages = [
    {
      id: ids.openMessage,
      name: "Priya Raman",
      email: "priya@demo.alignsynch.test",
      message:
        "I answered one side of our relationship but the report still says the Gap is not measured. " +
        "Is that because my colleague has not opened it yet?",
      status: "open",
      assignedUserId: adminUserId,
      assignedAt,
      // The instant the provider accepted the reply below. `0028` pairs it with the reply's `sent`
      // state, never with the attempt.
      sentAt: replyAt,
      // `NULL` is "not attempted yet" — the honest value for a row that no mailer ever started.
      mailOutcome: null,
      createdAt: shiftIso(nowIso, { hours: -30 }),
    },
    {
      id: ids.waitingMessage,
      name: "Tomas Beck",
      email: "tomas@demo.alignsynch.test",
      message:
        "Please take me off the announcements list, and thank you for the reminder about the trial.",
      status: "waiting",
      assignedUserId: adminUserId,
      assignedAt: waitingAssignedAt,
      sentAt: null,
      mailOutcome: null,
      createdAt: shiftIso(nowIso, { hours: -22 }),
    },
    {
      id: ids.newMessage,
      name: "Walt Ivers",
      email: "walt@demo.alignsynch.test",
      message:
        "Can a relationship be reopened after it has been voided, or does that need a new one?",
      status: "new",
      assignedUserId: null,
      assignedAt: null,
      sentAt: null,
      mailOutcome: null,
      createdAt: shiftIso(nowIso, { hours: -2 }),
    },
  ];

  const replies = [
    {
      id: ids.sentReply,
      messageId: ids.openMessage,
      authorUserId: adminUserId,
      body:
        "The Gap is measured once both seats have answered, so it will stay open until your colleague " +
        "submits. Their invitation is still live — you can re-send it from the relationship.",
      state: "sent",
      // A provider id would name a message that was never sent; the column is nullable for this.
      providerId: null,
      error: null,
      sentAt: replyAt,
      createdAt: replyAt,
    },
    {
      id: ids.failedReply,
      messageId: ids.waitingMessage,
      authorUserId: adminUserId,
      body: "You are off the list — I have marked the address unsubscribed, so nothing else will reach it.",
      state: "failed",
      providerId: null,
      // 0028 refuses a `failed` reply with nothing to show. This is why the address is `bounced`.
      error: "422 validation_error: recipient address has hard-bounced and cannot be mailed",
      sentAt: null,
      createdAt: shiftIso(nowIso, { hours: -19 }),
    },
  ];

  /* --- billing: the comp, the charge, and the webhook history ---------------------------- */
  const grantPeriodStart = granted.createdAtIso ?? shiftIso(nowIso, { days: -8 });
  const grants = [
    {
      id: ids.grant,
      relationshipId: granted.relationshipId,
      // The tier the relationship already reads. A comp writes `relationship.plan`, so granting
      // anything else would leave the row and the grant disagreeing on the same screen.
      planId: granted.planId,
      kind: "comp",
      periodStart: grantPeriodStart,
      periodEnd: shiftIso(grantPeriodStart, { days: 30 }),
      // `0026`'s reason is nullable since 0038: NULL means nobody stated one, which is true here.
      reason: null,
      grantedBy: adminUserId,
      createdAt: grantPeriodStart,
    },
  ];

  /*
   * **No `relationship_payment` row here any more** (t_b9679354). The fee a completed relationship
   * carries is owned by the seed's demo half (`scripts/db-seed-payments.mjs`), which writes it for
   * *every* complete relationship whose payer seat is an account, through the product's own writers
   * — this file authored the one row by hand, so the console's charge card showed a relationship the
   * rest of the demo could not account for. `paid` stays an anchor because the audit row and the
   * `invoice.paid` event below are this half's own facts: the money legitimately produced an event,
   * and the row it is about is the one the demo half wrote.
   */
  const billingEvents = [
    {
      provider: "mock",
      providerEventId: "demo-evt-invoice-paid",
      type: "invoice.paid",
      payloadDigest: digestOf(`invoice.paid:${paid.relationshipId}:${paid.priceCents}`),
      // The provider's receipt of the charge: a day after the fee landed, which is the
      // relationship's creation + 9 days (`scripts/db-seed-payments.mjs::feeScheduleOf` captures the
      // method at +1 and charges at +8).
      receivedAt: shiftIso(paid.createdAtIso, { days: 9 }),
    },
    {
      provider: "mock",
      providerEventId: "demo-evt-subscription-updated",
      type: "customer.subscription.updated",
      payloadDigest: digestOf(`customer.subscription.updated:${paid.initiatorUserId}`),
      receivedAt: shiftIso(nowIso, { days: -1 }),
    },
  ];

  /* --- the review shelf, on the artifact the screen opens by default --------------------- */
  const todos = [
    {
      id: ids.todoOpen,
      artifactId: artifact.id,
      body: "Walk stage 1's field inventory against docs/specs/flow-stages.md and list every drift.",
      doneAt: null,
      authorUserId: adminUserId,
      createdAt: shiftIso(nowIso, { days: -6 }),
    },
    {
      id: ids.todoDone,
      artifactId: artifact.id,
      body: "Confirm the relationship list's empty state reads as a state rather than a failure.",
      doneAt: shiftIso(nowIso, { days: -3 }),
      authorUserId: adminUserId,
      createdAt: shiftIso(nowIso, { days: -6 }),
    },
    {
      id: ids.todoLater,
      artifactId: artifact.id,
      body: "Draw the lapse band with its reason on the relationship detail page.",
      doneAt: shiftIso(nowIso, { days: -2 }),
      authorUserId: adminUserId,
      createdAt: shiftIso(nowIso, { days: -5 }),
    },
  ];

  const issues = [
    {
      id: ids.openIssue,
      artifactId: artifact.id,
      number: 1,
      title: "Stage 3's rail cell and the spec disagree on the count",
      body: "The rail prints `Stage 3 of 5` while the screen it opens is the aspects step. One of the two moved.",
      state: "open",
      labels: ["copy", "spec"],
      authorUserId: adminUserId,
      openedAt: shiftIso(nowIso, { days: -4 }),
      closedAt: null,
    },
    {
      id: ids.closedIssue,
      artifactId: artifact.id,
      number: 2,
      title: "The Gap figure has no label at 390px",
      body: "Below `sm` the number draws without its caption, so the reader cannot tell what it measures.",
      state: "closed",
      labels: ["layout"],
      authorUserId: adminUserId,
      openedAt: shiftIso(nowIso, { days: -9 }),
      // 0037 pairs a closed issue with its instant; reopening clears it.
      closedAt: shiftIso(nowIso, { days: -6 }),
    },
  ];

  const comments = [
    {
      id: ids.issueComment,
      issueId: ids.openIssue,
      body: "Confirmed on both brands. The rail cell opens the aspects step and prints the settings count.",
      authorUserId: adminUserId,
      createdAt: shiftIso(nowIso, { days: -3 }),
    },
    {
      id: ids.issueReply,
      issueId: ids.closedIssue,
      body: "Fixed: the caption is drawn at every width, and the number reads `Gap` under it.",
      authorUserId: adminUserId,
      createdAt: shiftIso(nowIso, { days: -6 }),
    },
  ];

  /* --- the audit log: one row per write above, pointing at the row it wrote --------------- */
  /*
   * `action` and `target_table` are drawn from `lib/admin/roles.ts`'s closed vocabularies, and the
   * test holds them there — an audit row naming an action `act()` would refuse is a log no filter
   * can find. Each `created_at` is the instant of the row the entry describes, which is how a log
   * reads beside the row it is about. `reason` is NULL: 0038 made it optional, and a reason nobody
   * typed is exactly what NULL means.
   */
  const audit = [
    {
      id: stableId("admin-action", "report/regenerate"),
      actorUserId: adminUserId,
      actorRole: "admin",
      action: "report.regenerate",
      targetTable: "session",
      targetId: paid.sessionRecordId,
      reason: null,
      before: null,
      after: null,
      createdAt: shiftIso(nowIso, { days: -6, hours: -3 }),
    },
    {
      id: stableId("admin-action", "plan/comp"),
      actorUserId: adminUserId,
      actorRole: "admin",
      action: "plan.comp",
      targetTable: "plan_grant",
      targetId: ids.grant,
      reason: null,
      before: null,
      after: { plan: granted.planId, kind: "comp" },
      createdAt: grantPeriodStart,
    },
    {
      id: stableId("admin-action", "broadcast/send"),
      actorUserId: adminUserId,
      actorRole: "admin",
      action: "broadcast.send",
      targetTable: "broadcast_send",
      targetId: ids.broadcast,
      reason: null,
      before: null,
      after: { recipients: consented.length, segment: "all" },
      createdAt: sendInstant,
    },
    {
      id: stableId("admin-action", "message/assign"),
      actorUserId: adminUserId,
      actorRole: "admin",
      action: "message.assign",
      targetTable: "contact_message",
      targetId: ids.openMessage,
      reason: null,
      before: null,
      after: { assigned: adminUserId },
      createdAt: assignedAt,
    },
    {
      id: stableId("admin-action", "message/reply"),
      actorUserId: adminUserId,
      actorRole: "admin",
      action: "message.reply",
      targetTable: "contact_reply",
      targetId: ids.sentReply,
      reason: null,
      before: null,
      after: { state: "sent" },
      createdAt: replyAt,
    },
    {
      id: stableId("admin-action", "review/issue"),
      actorUserId: adminUserId,
      actorRole: "admin",
      action: "review.issue",
      targetTable: "review_issue",
      targetId: ids.openIssue,
      reason: null,
      before: null,
      after: { number: 1, state: "open" },
      createdAt: shiftIso(nowIso, { days: -4 }),
    },
  ];

  /*
   * What every audit row is allowed to point at: the anchors, and the children this plan creates.
   * Anything else is a dangling reference, and `assertReferences()` refuses it before the first
   * statement runs — the check the card asks for ("assert it in the seed or a test").
   */
  const knownTargets = {
    session: new Set([paid.sessionRecordId, granted.sessionRecordId]),
    relationship: new Set([granted.relationshipId, paid.relationshipId]),
    user_profile: new Set([adminUserId, paid.initiatorUserId]),
    plan_grant: new Set([ids.grant]),
    broadcast_send: new Set([ids.broadcast]),
    contact_message: new Set(messages.map((row) => row.id)),
    contact_reply: new Set(replies.map((row) => row.id)),
    review_issue: new Set(issues.map((row) => row.id)),
  };

  const plan = {
    newsSignups,
    emailEvents,
    broadcastSends,
    broadcastRecipients,
    messages,
    replies,
    audit,
    grants,
    billingEvents,
    todos,
    issues,
    comments,
    knownTargets,
  };
  assertReferences(plan);
  return plan;
}

/**
 * Every `(target_table, target_id)` an audit row carries must name a row this plan wrote or an
 * anchor it read. Throws, naming the row — the one failure mode that would render a 404 from a list.
 */
export function assertReferences(plan) {
  for (const row of plan.audit) {
    const ids = plan.knownTargets[row.targetTable];
    if (!(ids instanceof Set)) {
      throw new Error(
        `audit row "${row.action}" targets table "${row.targetTable}", which this seed writes no row for`,
      );
    }
    if (!ids.has(row.targetId)) {
      throw new Error(
        `audit row "${row.action}" points at ${row.targetTable}/${row.targetId}, which this seed does not create — a dangling reference renders a 404 from /admin/audit`,
      );
    }
  }
  // The counts the expectation file records are a property of the plan, not of the SQL below.
  const counted = {
    admin_action: plan.audit.length,
    billing_event: plan.billingEvents.length,
    broadcast_recipient: plan.broadcastRecipients.length,
    broadcast_send: plan.broadcastSends.length,
    contact_message: plan.messages.length,
    contact_reply: plan.replies.length,
    email_event: plan.emailEvents.length,
    news_signup: plan.newsSignups.length,
    plan_grant: plan.grants.length,
    review_issue: plan.issues.length,
    review_issue_comment: plan.comments.length,
    review_todo: plan.todos.length,
  };
  for (const [table, count] of Object.entries(ADMIN_SURFACE_ROWS)) {
    if (counted[table] !== count) {
      throw new Error(
        `ADMIN_SURFACE_ROWS says ${table} is ${count} row(s) and this plan authors ${counted[table]} — the expectation file would record a number the seed does not write`,
      );
    }
  }
  return plan;
}

/* ------------------------------------------------------------------ *
 * The inserts — one statement per row, each converging on its own key
 * ------------------------------------------------------------------ */

const SQL = {
  newsSignup: `
    INSERT INTO news_signup (email, source, created_at, unsubscribed_at, bounced_at, complained_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (email) DO UPDATE SET
      source          = EXCLUDED.source,
      created_at      = EXCLUDED.created_at,
      unsubscribed_at = EXCLUDED.unsubscribed_at,
      bounced_at      = EXCLUDED.bounced_at,
      complained_at   = EXCLUDED.complained_at`,
  emailEvent: `
    INSERT INTO email_event (provider_event_id, type, recipient, subject, occurred_at, payload)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    ON CONFLICT (provider_event_id) DO UPDATE SET
      type        = EXCLUDED.type,
      recipient   = EXCLUDED.recipient,
      subject     = EXCLUDED.subject,
      occurred_at = EXCLUDED.occurred_at,
      payload     = EXCLUDED.payload`,
  broadcastSend: `
    INSERT INTO broadcast_send
      (id, actor_user_id, segment, segment_since, body_hash, subject, recipient_count, key_mode, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (id) DO UPDATE SET
      actor_user_id   = EXCLUDED.actor_user_id,
      segment         = EXCLUDED.segment,
      segment_since   = EXCLUDED.segment_since,
      body_hash       = EXCLUDED.body_hash,
      subject         = EXCLUDED.subject,
      recipient_count = EXCLUDED.recipient_count,
      key_mode        = EXCLUDED.key_mode,
      created_at      = EXCLUDED.created_at`,
  broadcastRecipient: `
    INSERT INTO broadcast_recipient (broadcast_id, email, created_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (broadcast_id, email) DO UPDATE SET created_at = EXCLUDED.created_at`,
  contactMessage: `
    INSERT INTO contact_message
      (id, name, email, message, status, assigned_user_id, assigned_at, sent_at, mail_outcome, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (id) DO UPDATE SET
      name             = EXCLUDED.name,
      email            = EXCLUDED.email,
      message          = EXCLUDED.message,
      status           = EXCLUDED.status,
      assigned_user_id = EXCLUDED.assigned_user_id,
      assigned_at      = EXCLUDED.assigned_at,
      sent_at          = EXCLUDED.sent_at,
      mail_outcome     = EXCLUDED.mail_outcome,
      created_at       = EXCLUDED.created_at`,
  contactReply: `
    INSERT INTO contact_reply
      (id, message_id, author_user_id, body, state, provider_id, error, sent_at, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (id) DO UPDATE SET
      message_id     = EXCLUDED.message_id,
      author_user_id = EXCLUDED.author_user_id,
      body           = EXCLUDED.body,
      state          = EXCLUDED.state,
      provider_id    = EXCLUDED.provider_id,
      error          = EXCLUDED.error,
      sent_at        = EXCLUDED.sent_at,
      created_at     = EXCLUDED.created_at`,
  adminAction: `
    INSERT INTO admin_action
      (id, actor_user_id, actor_role, action, target_table, target_id, reason, before, after, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)
    ON CONFLICT (id) DO UPDATE SET
      actor_user_id = EXCLUDED.actor_user_id,
      actor_role    = EXCLUDED.actor_role,
      action        = EXCLUDED.action,
      target_table  = EXCLUDED.target_table,
      target_id     = EXCLUDED.target_id,
      reason        = EXCLUDED.reason,
      before        = EXCLUDED.before,
      after         = EXCLUDED.after,
      created_at    = EXCLUDED.created_at`,
  planGrant: `
    INSERT INTO plan_grant
      (id, relationship_id, plan_id, kind, period_start, period_end, reason, granted_by, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (relationship_id, period_start) DO UPDATE SET
      plan_id     = EXCLUDED.plan_id,
      kind        = EXCLUDED.kind,
      period_end  = EXCLUDED.period_end,
      reason      = EXCLUDED.reason,
      granted_by  = EXCLUDED.granted_by,
      created_at  = EXCLUDED.created_at`,
  billingEvent: `
    INSERT INTO billing_event (provider, provider_event_id, type, payload_digest, received_at)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (provider, provider_event_id) DO UPDATE SET
      type           = EXCLUDED.type,
      payload_digest = EXCLUDED.payload_digest,
      received_at    = EXCLUDED.received_at`,
  reviewTodo: `
    INSERT INTO review_todo (id, artifact_id, body, done_at, author_user_id, created_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (id) DO UPDATE SET
      artifact_id    = EXCLUDED.artifact_id,
      body           = EXCLUDED.body,
      done_at        = EXCLUDED.done_at,
      author_user_id = EXCLUDED.author_user_id,
      created_at     = EXCLUDED.created_at`,
  reviewIssue: `
    INSERT INTO review_issue
      (id, artifact_id, number, title, body, state, labels, author_user_id, opened_at, closed_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (id) DO UPDATE SET
      artifact_id    = EXCLUDED.artifact_id,
      number         = EXCLUDED.number,
      title          = EXCLUDED.title,
      body           = EXCLUDED.body,
      state          = EXCLUDED.state,
      labels         = EXCLUDED.labels,
      author_user_id = EXCLUDED.author_user_id,
      opened_at      = EXCLUDED.opened_at,
      closed_at      = EXCLUDED.closed_at`,
  reviewComment: `
    INSERT INTO review_issue_comment (id, issue_id, body, author_user_id, created_at)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id) DO UPDATE SET
      issue_id       = EXCLUDED.issue_id,
      body           = EXCLUDED.body,
      author_user_id = EXCLUDED.author_user_id,
      created_at     = EXCLUDED.created_at`,
};

/* ------------------------------------------------------------------ *
 * Anchors — read from the branch, inside the seed's own transaction
 * ------------------------------------------------------------------ */

/**
 * The five anchors `adminSurfacePlan()` needs, read from the rows the seed has just written.
 *
 * **`active` and `complete` are the two statuses the billing half needs**, and each query picks one
 * deliberately rather than the first row to appear: the comp goes to an `active` relationship the
 * demo initiator owns (oldest id, so the choice is stable), and the charge goes to the **oldest**
 * `complete` one — its creation instant is far enough back that the method, the due date and the
 * charge all fall before `DEMO_NOW_ISO` instead of in the demo's future.
 *
 * Anything missing is a refusal that names what the dataset lacks. This file is written against
 * `data/assessment-population.ts` (through the bundle), and a population that stops carrying a
 * bound, plan-bearing relationship has to be a loud failure rather than a console with fewer rows.
 */
async function readAnchors(client) {
  const one = async (label, text, values = []) => {
    const { rows } = await client.query(text, values);
    const row = rows[0];
    if (row === undefined)
      throw new Error(`the admin half needs ${label}, and the branch has none`);
    return row;
  };

  const granted = await one(
    "an `active` relationship on a plan with an initiator account (the comp's target)",
    `SELECT r.id, r.plan, r.initiator_user_id, r.created_at, s.record_id AS session_record_id
       FROM relationship r
       JOIN session s ON s.relationship_id = r.id
      WHERE r.status = 'active' AND r.plan IS NOT NULL AND r.initiator_user_id IS NOT NULL
      ORDER BY r.id
      LIMIT 1`,
  );

  const paid = await one(
    "a `complete` relationship on a plan with an initiator account (the charge's target)",
    `SELECT r.id, r.plan, r.initiator_user_id, r.created_at, s.record_id AS session_record_id
       FROM relationship r
       JOIN session s ON s.relationship_id = r.id
      WHERE r.status = 'complete' AND r.plan IS NOT NULL AND r.initiator_user_id IS NOT NULL
      ORDER BY r.created_at, r.id
      LIMIT 1`,
  );

  const price = await one(
    `a \`billing_plan\` month row for the "${paid.plan}" tier (the amount a checkout charges)`,
    "SELECT price_cents FROM billing_plan WHERE id = $1 AND interval = 'month'",
    [paid.plan],
  );

  const artifact = await one(
    "a review artifact (the shelf `/admin/review` opens by default)",
    `SELECT id FROM review_artifact ORDER BY captured_at DESC, id LIMIT 1`,
  );

  return {
    granted: {
      relationshipId: granted.id,
      planId: granted.plan,
      sessionRecordId: granted.session_record_id,
      createdAtIso: new Date(granted.created_at).toISOString(),
    },
    paid: {
      relationshipId: paid.id,
      planId: paid.plan,
      sessionRecordId: paid.session_record_id,
      initiatorUserId: paid.initiator_user_id,
      priceCents: price.price_cents,
      createdAtIso: new Date(paid.created_at).toISOString(),
    },
    artifact: { id: artifact.id },
  };
}

/* ------------------------------------------------------------------ *
 * The writer
 * ------------------------------------------------------------------ */

/**
 * Writes the admin half, inside the caller's transaction, and returns what it wrote.
 *
 * The caller is `scripts/db-seed.mjs`'s phase 2 under `DEMO_AUTH=1` — after the content, after the
 * accounts (every actor id is one of them), and after `syncReviewArtifacts` (the issues hang off an
 * artifact row). Nothing here opens a transaction of its own: a failure must roll the whole seed
 * back, and a half-written console is not a state anybody should have to diagnose.
 */
export async function seedAdminSurfaces(client, { actorUserId, nowIso }) {
  const anchors = await readAnchors(client);
  const plan = adminSurfacePlan({ ...anchors, nowIso, adminUserId: actorUserId });

  /*
   * `review_issue` is numbered per artifact, and the number is unique there. My two rows take #1
   * and #2, so an issue somebody raised by hand on this artifact would collide rather than
   * converge. Refuse by name instead of letting the unique index answer with a 23505 nobody can
   * read: overwriting a person's feedback to make a seed green is not a trade this file makes.
   */
  for (const issue of plan.issues) {
    const { rows } = await client.query(
      "SELECT id FROM review_issue WHERE artifact_id = $1 AND number = $2 AND id <> $3",
      [issue.artifactId, issue.number, issue.id],
    );
    if (rows.length > 0) {
      throw new Error(
        `${issue.artifactId} already carries a hand-raised issue #${issue.number} — the demo's review rows ` +
          "would overwrite somebody's feedback, so nothing was written (run `pnpm demo:reset` to put the branch back)",
      );
    }
  }

  for (const row of plan.newsSignups) {
    await client.query(SQL.newsSignup, [
      row.email,
      row.source,
      row.createdAt,
      row.unsubscribedAt,
      row.bouncedAt,
      row.complainedAt,
    ]);
  }
  for (const row of plan.emailEvents) {
    await client.query(SQL.emailEvent, [
      row.providerEventId,
      row.type,
      row.recipient,
      row.subject,
      row.occurredAt,
      JSON.stringify(row.payload),
    ]);
  }
  for (const row of plan.broadcastSends) {
    await client.query(SQL.broadcastSend, [
      row.id,
      row.actorUserId,
      row.segment,
      row.segmentSince,
      row.bodyHash,
      row.subject,
      row.recipientCount,
      row.keyMode,
      row.createdAt,
    ]);
  }
  for (const row of plan.broadcastRecipients) {
    await client.query(SQL.broadcastRecipient, [row.broadcastId, row.email, row.createdAt]);
  }
  for (const row of plan.messages) {
    await client.query(SQL.contactMessage, [
      row.id,
      row.name,
      row.email,
      row.message,
      row.status,
      row.assignedUserId,
      row.assignedAt,
      row.sentAt,
      row.mailOutcome,
      row.createdAt,
    ]);
  }
  for (const row of plan.replies) {
    await client.query(SQL.contactReply, [
      row.id,
      row.messageId,
      row.authorUserId,
      row.body,
      row.state,
      row.providerId,
      row.error,
      row.sentAt,
      row.createdAt,
    ]);
  }
  for (const row of plan.grants) {
    await client.query(SQL.planGrant, [
      row.id,
      row.relationshipId,
      row.planId,
      row.kind,
      row.periodStart,
      row.periodEnd,
      row.reason,
      row.grantedBy,
      row.createdAt,
    ]);
  }
  for (const row of plan.billingEvents) {
    await client.query(SQL.billingEvent, [
      row.provider,
      row.providerEventId,
      row.type,
      row.payloadDigest,
      row.receivedAt,
    ]);
  }
  for (const row of plan.todos) {
    await client.query(SQL.reviewTodo, [
      row.id,
      row.artifactId,
      row.body,
      row.doneAt,
      row.authorUserId,
      row.createdAt,
    ]);
  }
  for (const row of plan.issues) {
    await client.query(SQL.reviewIssue, [
      row.id,
      row.artifactId,
      row.number,
      row.title,
      row.body,
      row.state,
      row.labels,
      row.authorUserId,
      row.openedAt,
      row.closedAt,
    ]);
  }
  for (const row of plan.comments) {
    await client.query(SQL.reviewComment, [
      row.id,
      row.issueId,
      row.body,
      row.authorUserId,
      row.createdAt,
    ]);
  }
  // The audit rows are written last, for the reason `act()` writes them last: an entry that
  // described a write which then failed is a log of something that did not happen.
  for (const row of plan.audit) {
    await client.query(SQL.adminAction, [
      row.id,
      row.actorUserId,
      row.actorRole,
      row.action,
      row.targetTable,
      row.targetId,
      row.reason,
      row.before === null ? null : JSON.stringify(row.before),
      row.after === null ? null : JSON.stringify(row.after),
      row.createdAt,
    ]);
  }

  return {
    anchors,
    plan,
    counts: { ...ADMIN_SURFACE_ROWS },
    subjects: {
      grantedRelationship: plan.grants[0].relationshipId,
      paidRelationship: anchors.paid.relationshipId,
      artifact: plan.issues[0].artifactId,
    },
  };
}
