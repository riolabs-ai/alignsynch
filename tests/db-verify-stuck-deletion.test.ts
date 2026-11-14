/**
 * V28 — an unfinished deletion has an owner (#278 follow-up).
 *
 * #601 made a failed scrub resumable: `account_deletion_job` records `{user_id, email, names,
 * roles}` before the irreversible auth delete, and `runAccountDeletion()` resumes from that row.
 * Nothing watched the row. A scrub that failed and was never retried left an address `/privacy`
 * says is "removed permanently" sitting in the table with `finished_at IS NULL`, no clock and no
 * owner — recoverable, and invisible.
 *
 * The check is `stuckDeletionJobProblems()` in `scripts/db-verify.mjs`, exported for the same
 * reason `seededInstanceStatusProblems()` and `orphanProfileProblems()` are: the gate is
 * database-free (`docs/operations/gate.md`), so the part that decides an answer takes rows and a `now`, and
 * these cases feed it both. The boundary cases are logged as comments beside the rule: the
 * threshold exists so an ordinary in-flight scrub never fires it, which is only true if the
 * comparison is `>=` and not `>`.
 *
 * The last case is the one that matters most: the pure function can be perfect while the script
 * never calls it, and that is exactly the drift this card was opened for — a rule in a test and
 * not in the tool.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { STUCK_DELETION_JOB_HOURS, stuckDeletionJobProblems } from "../scripts/db-verify.mjs";

const HOUR = 60 * 60 * 1000;
/** A fixed `now`, so the cases do not depend on the day they run. */
const NOW = Date.UTC(2026, 10, 7, 12, 0, 0);

/** One row of `account_deletion_job`, shaped as `pg` returns it. */
interface JobRow {
  user_id: string;
  started_at: Date;
  finished_at: Date | null;
}

function job(userId: string, hoursAgo: number, finished = false): JobRow {
  const startedAt = new Date(NOW - hoursAgo * HOUR);
  return {
    user_id: userId,
    started_at: startedAt,
    finished_at: finished ? new Date(NOW - (hoursAgo - 1) * HOUR) : null,
  };
}

describe("V28's rule", () => {
  it("names an open row older than the threshold, and never the address", () => {
    const problems = stuckDeletionJobProblems([job("acct-1", 25)], NOW);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.code).toBe("V28");
    expect(problems[0]?.message).toContain("acct-1");
    expect(problems[0]?.message).toContain("25 h");
    // The output is pasted into cards and CI logs; the row exists so an operator can act on an
    // id, and printing the address would leak the fact the check reports.
    expect(problems[0]?.message).not.toMatch(/@/);
    // It does point at the procedure that finishes the job, so the line is actionable.
    expect(problems[0]?.message).toContain("specs/account-deletion-spec.md §7");
  });

  it("stays green under the threshold, and fires exactly at it", () => {
    // 23 h is an in-flight scrub: a detector that fires here is noise that gets scrolled past.
    expect(stuckDeletionJobProblems([job("acct-1", 23)], NOW)).toEqual([]);
    // Only the last few minutes of the window are still "in flight".
    expect(stuckDeletionJobProblems([job("acct-1", 23.98)], NOW)).toEqual([]);
    // The boundary is `>=`: a row that has just crossed 24 h is the first one that counts.
    expect(stuckDeletionJobProblems([job("acct-1", STUCK_DELETION_JOB_HOURS)], NOW)).toHaveLength(
      1,
    );
  });

  it("ignores a finished row, however old", () => {
    // §6 keeps a finished row indefinitely — an opaque id and two instants, not a person.
    expect(stuckDeletionJobProblems([job("acct-1", 24 * 30, true)], NOW)).toEqual([]);
  });

  it("names every stuck row, and only the stuck ones", () => {
    const problems = stuckDeletionJobProblems(
      [job("acct-1", 48), job("acct-2", 2), job("acct-3", 30, true), job("acct-4", 26)],
      NOW,
    );
    expect(problems.map((problem: { message: string }) => problem.message).join("\n")).toContain(
      "acct-1",
    );
    expect(problems).toHaveLength(2);
    expect(problems[1]?.message).toContain("acct-4");
  });

  it("is wired into scripts/db-verify.mjs, not only into this file", () => {
    const source = readFileSync(new URL("../scripts/db-verify.mjs", import.meta.url), "utf8");
    // The rows the check reads are the **open** ones, and the call site exists.
    expect(source).toContain("FROM account_deletion_job");
    expect(source).toContain("WHERE finished_at IS NULL");
    expect(source).toContain("stuckDeletionJobProblems(openJobs)");
  });
});
