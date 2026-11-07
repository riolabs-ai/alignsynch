/**
 * #667 — the review store against **real Postgres**, which is the only place three of this card's
 * four acceptance lines can be answered.
 *
 * `tests/review-store.test.ts` proves the model, the mappers and the V29 rule over plain objects.
 * This file proves the SQL:
 *
 *   - **the number is handed out serially.** Six `openReviewIssue()` calls fire at once against one
 *     artifact and the store answers `#1 … #6` — not because `max(number) + 1` is safe (it is not),
 *     but because the insert takes the artifact row `FOR UPDATE` first. A fake `sql` cannot answer
 *     this question, and it is the one bug that makes the list untrustworthy.
 *   - **a tick survives a reload.** The write goes through `act()`, the read goes through
 *     `readReviewArtifact()` — the same function the page will call — so `done_at` is proven to be
 *     in the database and not in a component's state.
 *   - **closing sets `closed_at`, reopening clears it**, read back through the model's own
 *     refinement (a `closed` issue with no instant would fail that parse).
 *   - **a non-staff write is refused server-side.** The actor here has *no* `user_profile` row at
 *     all, which is the fail-closed default `DEFAULT_USER_ROLE = "member"`: `act()` refuses
 *     `role-too-low` and no row is written. That is the "not by hiding a control" half of the card,
 *     measured rather than asserted.
 *
 * **Skipped unless `DATABASE_URL` is set**, like the other `*-live.test.ts` files: the gate has no
 * connection string by design, so this costs CI nothing and runs when somebody points it at a
 * branch. It writes nothing outside `review_*` — the staff actor is an **existing** profile it
 * reads rather than one it creates, precisely so a killed run cannot leave an orphan profile for
 * V27 to find on the shared demo branch — and the rows it does create are deleted in `afterAll`.
 *
 *     DATABASE_URL=<demo branch url> npx vitest run tests/review-store-live.test.ts
 *
 * **Never point this at production.** The host is printed on the first line of the run and the
 * known live endpoint is refused outright rather than trusted to the caller's memory.
 */
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ActRefused } from "@/lib/admin/act";
import {
  commentOnReviewIssue,
  openReviewIssue,
  ReviewOpRefused,
  setReviewIssueState,
  toggleReviewTodo,
} from "@/lib/admin/review-ops";
import {
  listReviewArtifacts,
  readReviewArtifact,
  reviewIssueFromRow,
} from "@/lib/db/review-artifacts";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const live = databaseUrl === "" ? describe.skip : describe;

/** The live endpoint `ep-winter-block` is production; a probe must never open a connection to it. */
const PRODUCTION_HOST = "ep-winter-block-b4bkk1xc";
const host = databaseUrl === "" ? "(none)" : (databaseUrl.match(/@([^/:]+)/)?.[1] ?? "(unknown)");
const onProduction = host.startsWith(PRODUCTION_HOST);

const TAG = `review-probe-${Date.now().toString(36)}`;
const artifactId = `${TAG}-artifact`;
const todoId = `${TAG}-todo`;

const pool = new Pool({ connectionString: databaseUrl, max: 2, application_name: "review-probe" });

/** A person who may write: any existing profile at `support` or above. Read, never created. */
let staffUserId = "";

/** The ids this run wrote, so the cleanup can find its `admin_action` rows too. */
const writtenTargets: string[] = [];

beforeAll(async () => {
  if (onProduction) {
    throw new Error(
      `review-store-live: refusing to run against production (${host}) — point DATABASE_URL at the demo branch`,
    );
  }
  console.log(`review-store-live: database host ${host}`);
  const { rows } = await pool.query(
    "SELECT user_id FROM user_profile WHERE role IN ('support', 'admin', 'owner') ORDER BY joined_at LIMIT 1",
  );
  staffUserId = rows[0]?.user_id ?? "";
  if (staffUserId === "") {
    throw new Error(
      "review-store-live: this branch has no profile at support or above — run `DEMO_AUTH=1 pnpm db:seed` first",
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
    [todoId, artifactId, staffUserId],
  );
});

afterAll(async () => {
  if (databaseUrl === "") return;
  try {
    const { rows: issues } = await pool.query(
      "SELECT id FROM review_issue WHERE artifact_id = $1",
      [artifactId],
    );
    const targets = [...writtenTargets, todoId, ...issues.map((row: { id: string }) => row.id)];
    if (targets.length > 0) {
      // `admin_action` is append-only in production; a probe that wrote rows on a shared branch
      // takes its own back so /admin/audit is not asked to explain them later.
      await pool.query("DELETE FROM admin_action WHERE target_id = ANY($1::text[])", [targets]);
    }
    // Cascades to review_todo, review_issue and review_issue_comment.
    await pool.query("DELETE FROM review_artifact WHERE id = $1", [artifactId]);
  } finally {
    await pool.end();
  }
});

live("the review store on a real branch", () => {
  it("numbers issues 1..N under six concurrent raisers", { timeout: 120_000 }, async () => {
    const raised = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        openReviewIssue({
          actorUserId: staffUserId,
          artifactId,
          title: `Concurrent raiser ${index + 1}`,
          body: "",
          labels: [],
          reason: "probe: concurrent number assignment",
        }),
      ),
    );
    for (const result of raised) writtenTargets.push(result.after.issueId);
    const numbers = raised.map((result) => result.after.number).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6]);

    const { rows } = await pool.query(
      "SELECT number, count(*)::int AS n FROM review_issue WHERE artifact_id = $1 GROUP BY number ORDER BY number",
      [artifactId],
    );
    expect(rows.map((row: { n: number }) => row.n)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(rows.map((row: { number: number }) => row.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("keeps a tick across a reload, read back through the page's own reader", async () => {
    await toggleReviewTodo({
      actorUserId: staffUserId,
      artifactId,
      todoId,
      done: true,
      reason: "probe: tick survives a reload",
    });
    const afterTick = await readReviewArtifact(artifactId);
    expect(afterTick?.todos.find((todo) => todo.id === todoId)?.doneAt).not.toBeNull();
    expect(afterTick?.progress.todosDone).toBe(1);

    // Untick and read again: the absence is a fact too, or the checkbox only ever fills in.
    await toggleReviewTodo({
      actorUserId: staffUserId,
      artifactId,
      todoId,
      done: false,
      reason: "probe: untick clears the instant",
    });
    const afterUntick = await readReviewArtifact(artifactId);
    expect(afterUntick?.todos.find((todo) => todo.id === todoId)?.doneAt).toBeNull();
    expect(afterUntick?.progress.todosDone).toBe(0);
  });

  it("sets closed_at on close and clears it on reopen", async () => {
    const { rows } = await pool.query(
      "SELECT id FROM review_issue WHERE artifact_id = $1 AND number = 1",
      [artifactId],
    );
    const issueId = rows[0]?.id as string;
    expect(issueId).toBeTruthy();

    const closed = await setReviewIssueState({
      actorUserId: staffUserId,
      issueId,
      state: "closed",
      reason: "probe: close sets the instant",
    });
    expect(closed.after.state).toBe("closed");
    expect(closed.after.closed_at).not.toBeNull();

    // The model's own refinement is the assertion: a closed issue with no instant would not parse.
    const reopenedIssue = await readReviewIssueRow(issueId);
    expect(reopenedIssue?.state).toBe("closed");
    expect(reopenedIssue?.closedAt).not.toBeNull();

    const reopened = await setReviewIssueState({
      actorUserId: staffUserId,
      issueId,
      state: "open",
      reason: "probe: reopen clears the instant",
    });
    expect(reopened.after.closed_at).toBeNull();
    const open = await readReviewIssueRow(issueId);
    expect(open?.state).toBe("open");
    expect(open?.closedAt).toBeNull();
  });

  it("refuses a write from an account with no profile, server-side", async () => {
    const memberActor = `${TAG}-stranger`;
    const before = await countIssues();
    const refusal = await openReviewIssue({
      actorUserId: memberActor,
      artifactId,
      title: "Should never exist",
      body: "",
      labels: [],
      reason: "probe: a member is not staff",
    }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(refusal).toBeInstanceOf(ActRefused);
    expect((refusal as ActRefused).reason).toBe("role-too-low");
    expect(await countIssues()).toBe(before);

    // A comment and a toggle are refused through the same transaction, not by a hidden control.
    const comment = await commentOnReviewIssue({
      actorUserId: memberActor,
      issueId: "review-issue-does-not-matter",
      body: "nope",
      reason: "probe: a member is not staff",
    }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(comment).toBeInstanceOf(ActRefused);
    const toggle = await toggleReviewTodo({
      actorUserId: memberActor,
      artifactId,
      todoId,
      done: true,
      reason: "probe: a member is not staff",
    }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(toggle).toBeInstanceOf(ActRefused);
  });

  it("refuses an issue against an artifact that is not there", async () => {
    const refusal = await openReviewIssue({
      actorUserId: staffUserId,
      artifactId: `${TAG}-missing`,
      title: "Nothing to raise this against",
      body: "",
      labels: [],
      reason: "probe: no such artifact",
    }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(refusal).toBeInstanceOf(ReviewOpRefused);
    expect((refusal as ReviewOpRefused).reason).toBe("no-such-artifact");
  });

  it("counts the same thing in the list as in the viewer", async () => {
    const detail = await readReviewArtifact(artifactId);
    const list = await listReviewArtifacts();
    const summary = list.find((entry) => entry.artifact.id === artifactId);
    expect(detail).not.toBeNull();
    expect(summary).toBeDefined();
    // The list sums in SQL, the viewer counts the rows it holds: one sentence, two spellings.
    expect(summary?.progress).toEqual(detail?.progress);
  });
});

/** One issue read through the read module — the mapper is the assertion, not a raw row. */
async function readReviewIssueRow(issueId: string) {
  const { rows } = await pool.query(
    "SELECT id, artifact_id, number, title, body, state, labels, author_user_id, opened_at, closed_at FROM review_issue WHERE id = $1",
    [issueId],
  );
  const row = rows[0];
  if (row === undefined) return null;
  return reviewIssueFromRow(row);
}

/** How many issues this probe artifact holds — the "nothing was written" half of a refusal. */
async function countIssues(): Promise<number> {
  const { rows } = await pool.query(
    "SELECT count(*)::int AS n FROM review_issue WHERE artifact_id = $1",
    [artifactId],
  );
  return rows[0]?.n ?? 0;
}
