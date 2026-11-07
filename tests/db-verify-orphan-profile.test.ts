/**
 * V27 — no orphan profile (#278, spec §7 step 5).
 *
 * The state this names is the one the deletion sweep's own order can leave: the auth user is
 * deleted **first** (`docs/ACCOUNT-DELETION-SPEC.md` §7 step 3) and the `public` scrub runs after
 * it, so a scrub that fails leaves a `user_profile` row whose `neon_auth."user"` id is gone. No
 * foreign key refuses it — `public` holds none into the managed schema (`0003`'s header) — and no
 * read notices: `/profile/<handle>` keeps resolving, and the `UNIQUE` handle stays taken.
 *
 * The check is `orphanProfileProblems()` in `scripts/db-verify.mjs`, exported for exactly this
 * reason: the gate is database-free (`docs/GATE.md`), so the part that decides an answer takes two
 * id lists and the cases here feed them.
 *
 * Measured before the rule existed, on the demo branch: eight such rows were left behind by a real
 * deletion run (handles `probe-*`, auth ids no longer in `neon_auth."user"`) and `db:verify` was
 * green. That is the drift these cases pin.
 */
import { describe, expect, it } from "vitest";

import { orphanProfileProblems } from "../scripts/db-verify.mjs";

/** One auth id that both `neon_auth."user"` and a `user_profile` row carry. */
const LIVE = "1f0d3c76-6a2e-4f8a-9f43-0f0f5c1d7e11";

describe("orphanProfileProblems", () => {
  it("says nothing when every profile names a live account", () => {
    expect(orphanProfileProblems([LIVE], [LIVE])).toEqual([]);
  });

  it("names the one profile whose account is gone", () => {
    const gone = "probe-mw61mnk4-2fk-account";
    const problems = orphanProfileProblems([LIVE, gone], [LIVE]);

    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("V27");
    expect(problems[0].message).toContain(gone);
    expect(problems[0].message).toContain("/profile/<handle>");
  });

  it("reports every orphan, not just the first", () => {
    const problems = orphanProfileProblems(["a", "b", "c"], ["b"]);

    expect(problems).toHaveLength(2);
    expect(problems.map((problem) => problem.message.match(/"([^"]+)"/)?.[1])).toEqual(["a", "c"]);
  });

  it("finds nothing to check in an empty profile table", () => {
    expect(orphanProfileProblems([], [LIVE])).toEqual([]);
  });

  it("treats an empty auth table as every profile orphaned", () => {
    const problems = orphanProfileProblems([LIVE], []);

    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("V27");
  });
});
