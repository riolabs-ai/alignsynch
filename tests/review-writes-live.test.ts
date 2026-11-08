/**
 * `/admin/review`'s three writes **against real Postgres** (#665 follow-up), which is the only place
 * this card's acceptance lines can be answered rather than described.
 *
 * `tests/review-writes-mount.test.tsx` proves the screen posts the store's shapes and draws a
 * refusal. This file proves the other end of the same click:
 *
 *   - **a `support` rung is refused by `act()`**, on a real transaction, with no row written and no
 *     audit entry — the card's "not by a silent no-op" half, measured;
 *   - **a tick survives a reload**, read back through `readReviewArtifact()` — the function the page
 *     itself calls, not a raw `SELECT`;
 *   - **closing an issue moves the list's counts** — `listReviewArtifacts()` is what draws the
 *     `5 open · 2 closed` line, so a close that only changed the viewer would fail here;
 *   - **every write leaves one `admin_action` row naming its target** — that is what `/admin/audit`
 *     reads, and a write without it is a write nobody can account for.
 *
 * **Skipped unless `DATABASE_URL` is set**, like the other `*-live.test.ts` files: the gate has no
 * connection string by design, so this costs CI nothing and runs when somebody points it at a
 * branch. It takes its own rows back in `afterAll` — the review artifact (cascading to its to-dos,
 * issues and comments), the two probe profiles and the audit rows — because the demo branch is
 * shared and `/admin/audit` should not have to explain a probe.
 *
 *     DATABASE_URL=<demo branch url> npx vitest run tests/review-writes-live.test.ts
 *
 * **Never point this at production.** The host is printed on the first line of the run and the
 * known live endpoint is refused outright rather than trusted to the caller's memory.
 */
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ActRefused } from "@/lib/admin/act";
import {
  commentOnReviewIssue,
  setReviewIssueState,
  toggleReviewTodo,
} from "@/lib/admin/review-ops";
import {
  listReviewArtifacts,
  readReviewArtifact,
  readReviewIssue,
} from "@/lib/db/review-artifacts";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const live = databaseUrl === "" ? describe.skip : describe;

/** The live endpoint `ep-winter-block` is production; a probe must never open a connection to it. */
const PRODUCTION_HOST = "ep-winter-block-b4bkk1xc";
const host = databaseUrl === "" ? "(none)" : (databaseUrl.match(/@([^/:]+)/)?.[1] ?? "(unknown)");
const onProduction = host.startsWith(PRODUCTION_HOST);

const TAG = `rvw-${Date.now().toString(36)}`;
const artifactId = `${TAG}-artifact`;
const todoId = `${TAG}-todo`;
const adminUserId = `${TAG}-admin`;
const supportUserId = `${TAG}-support`;

const pool = new Pool({ connectionString: databaseUrl, max: 2, application_name: "review-writes" });

/** Every id this run wrote, so cleanup can find the audit rows too. */
const writtenTargets: string[] = [todoId];

beforeAll(async () => {
  if (onProduction) {
    throw new Error(
      `review-writes-live: refusing to run against production (${host}) — point DATABASE_URL at the demo branch`,
    );
  }
  console.log(`review-writes-live: database host ${host}`);
  // Two seats, created here and deleted in `afterAll`: the shelf is `requireAdmin()`, so `admin`
  // is the rung that may write and `support` is the rung the card says must be refused.
  for (const [userId, role, handle] of [
    [adminUserId, "admin", `${TAG}-a`],
    [supportUserId, "support", `${TAG}-s`],
  ]) {
    await pool.query(
      `INSERT INTO user_profile (user_id, handle, display_name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, handle, `Review probe ${role}`, role],
    );
  }
  await pool.query(
    `INSERT INTO review_artifact (id, slug, title, kind, version, path, captured_at)
     VALUES ($1, $1, 'Probe artifact', 'prototype', 'v1', $2, '2026-11-07T00:00:00.000Z')`,
    [artifactId, `docs/review/artifacts/${TAG}.html`],
  );
  await pool.query(
    `INSERT INTO review_todo (id, artifact_id, body, author_user_id)
     VALUES ($1, $2, 'Tick me and reload', $3)`,
    [todoId, artifactId, adminUserId],
  );
});

afterAll(async () => {
  if (databaseUrl === "") return;
  try {
    await pool.query("DELETE FROM admin_action WHERE target_id = ANY($1::text[])", [
      writtenTargets,
    ]);
    // Cascades to review_todo, review_issue and review_issue_comment.
    await pool.query("DELETE FROM review_artifact WHERE id = $1", [artifactId]);
    await pool.query("DELETE FROM user_profile WHERE user_id = ANY($1::text[])", [
      [adminUserId, supportUserId],
    ]);
  } finally {
    await pool.end();
  }
});

/** How many audit rows name one target — the write's only accounting. */
async function auditRowsFor(targetId: string): Promise<{ action: string; actor: string }[]> {
  const { rows } = await pool.query(
    "SELECT action, actor_user_id AS actor FROM admin_action WHERE target_id = $1 ORDER BY id",
    [targetId],
  );
  return rows as { action: string; actor: string }[];
}

/** The one issue this artifact holds, raised directly: the store's raise path is #667's suite. */
let issueSequence = 0;

async function raiseProbeIssue(title: string): Promise<string> {
  issueSequence += 1;
  const { rows } = await pool.query(
    `INSERT INTO review_issue (id, artifact_id, number, title, body, state, labels, author_user_id)
     VALUES ($1, $2, $3, $4, '', 'open', '{}'::text[], $5)
     RETURNING id`,
    [`${TAG}-issue-${issueSequence}`, artifactId, issueSequence, title, adminUserId],
  );
  const id = rows[0]?.id as string;
  writtenTargets.push(id);
  return id;
}

live("the review writes on a real branch", () => {
  it("refuses a support seat on all three writes, inside the transaction, writing nothing", {
    timeout: 60_000,
  }, async () => {
    const issueId = await raiseProbeIssue("Refused by the support rung");
    const beforeAudit = await auditRowsFor(todoId);

    const refused = async (run: () => Promise<unknown>): Promise<unknown> =>
      run().then(
        () => null,
        (error: unknown) => error,
      );

    const toggle = await refused(() =>
      toggleReviewTodo({
        actorUserId: supportUserId,
        artifactId,
        todoId,
        done: true,
        reason: "probe: a support seat may not tick",
      }),
    );
    const close = await refused(() =>
      setReviewIssueState({
        actorUserId: supportUserId,
        issueId,
        state: "closed",
        reason: "probe: a support seat may not close",
      }),
    );
    const comment = await refused(() =>
      commentOnReviewIssue({
        actorUserId: supportUserId,
        issueId,
        body: "should not exist",
        reason: "probe: a support seat may not reply",
      }),
    );

    for (const [label, refusal] of [
      ["toggle", toggle],
      ["close", close],
      ["comment", comment],
    ] as const) {
      expect(refusal, `${label} is refused, not silently dropped`).toBeInstanceOf(ActRefused);
      expect((refusal as ActRefused).reason, `${label}'s code the screen has a sentence for`).toBe(
        "role-too-low",
      );
    }

    const after = await readReviewArtifact(artifactId);
    expect(after?.todos.find((row) => row.id === todoId)?.doneAt).toBeNull();
    expect(after?.issues.find((row) => row.id === issueId)?.state).toBe("open");
    expect(after?.issues.find((row) => row.id === issueId)?.closedAt).toBeNull();
    const thread = await readReviewIssue(issueId);
    expect(thread?.comments).toHaveLength(0);
    // Nothing was audited either: a refusal happens before the mutation, so there is no entry.
    expect(await auditRowsFor(todoId)).toEqual(beforeAudit);
    expect(await auditRowsFor(issueId)).toEqual([]);
  });

  it("keeps an admin's tick across a reload, read back through the page's own reader", async () => {
    await toggleReviewTodo({
      actorUserId: adminUserId,
      artifactId,
      todoId,
      done: true,
      reason: "probe: tick survives a reload",
    });

    const afterTick = await readReviewArtifact(artifactId);
    expect(afterTick?.todos.find((row) => row.id === todoId)?.doneAt).not.toBeNull();
    expect(afterTick?.progress.todosDone).toBe(1);

    // The audit row `/admin/audit` draws, with the machine sentence a checkbox produces.
    const audit = await auditRowsFor(todoId);
    expect(audit).toHaveLength(1);
    expect(audit[0]?.action).toBe("review.todo");
    expect(audit[0]?.actor).toBe(adminUserId);

    await toggleReviewTodo({
      actorUserId: adminUserId,
      artifactId,
      todoId,
      done: false,
      reason: "probe: untick clears the instant",
    });
    const afterUntick = await readReviewArtifact(artifactId);
    expect(afterUntick?.todos.find((row) => row.id === todoId)?.doneAt).toBeNull();
    expect(afterUntick?.progress.todosDone).toBe(0);
  });

  it("moves the list's counts when an issue is closed, and moves them back when it reopens", async () => {
    const issueId = await raiseProbeIssue("Counted on the row above the panes");

    const countOf = async () => {
      const list = await listReviewArtifacts();
      const summary = list.find((entry) => entry.artifact.id === artifactId);
      return {
        open: summary?.progress.issuesOpen ?? 0,
        closed: summary?.progress.issuesClosed ?? 0,
      };
    };

    // Relative to whatever earlier cases left on this artifact: the row's line is the same SQL
    // aggregate the page draws, and this case owns one issue of it.
    const before = await countOf();
    expect(before.closed).toBe(0);

    await setReviewIssueState({
      actorUserId: adminUserId,
      issueId,
      state: "closed",
      reason: "probe: close moves the count",
    });
    expect(await countOf()).toEqual({ open: before.open - 1, closed: 1 });
    const closed = await readReviewIssue(issueId);
    expect(closed?.issue.state).toBe("closed");
    expect(closed?.issue.closedAt).not.toBeNull();

    await setReviewIssueState({
      actorUserId: adminUserId,
      issueId,
      state: "open",
      reason: "probe: reopen moves it back",
    });
    expect(await countOf()).toEqual({ open: before.open, closed: 0 });
    expect((await readReviewIssue(issueId))?.issue.closedAt).toBeNull();

    // Two state changes, two audit rows, both naming the issue rather than the artifact.
    const audit = await auditRowsFor(issueId);
    expect(audit).toHaveLength(2);
    expect(audit.every((row) => row.action === "review.issue")).toBe(true);
  });

  it("lands a comment on the thread and accounts for it in the audit log", async () => {
    const issueId = await raiseProbeIssue("Commented on from the review screen");
    const comment = await commentOnReviewIssue({
      actorUserId: adminUserId,
      issueId,
      body: "The second aspect now has its right-hand label.",
      reason: "reply to issue #2",
    });
    writtenTargets.push(comment.after.commentId);

    const thread = await readReviewIssue(issueId);
    expect(thread?.comments.map((row) => row.body)).toEqual([
      "The second aspect now has its right-hand label.",
    ]);
    const audit = await auditRowsFor(comment.after.commentId);
    expect(audit).toEqual([{ action: "review.comment", actor: adminUserId }]);
  });
});
