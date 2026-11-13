/**
 * The preserved-branch policy and the branch-ceiling pre-flight, proved against a fake API
 * (#909) — no Neon key, no network call, nothing deleted.
 *
 * The project this reproduces is the live one on 2026-11-12: ten branches against a limit of ten,
 * the `Demo reset` workflow red twice, and this the whole failure —
 *
 *   ▶ reset demo from demo-base (one restore, not a delete)
 *     children  none — the body carries no preserve_under_name, so nothing is preserved
 *   ✗ demo:reset failed: POST …/branches/br-wispy-frog-b43188n8/restore answered HTTP 422 —
 *     branches limit exceeded
 *
 * — so the restore that failed was the **plain** body. The fixture above is that branch list, with
 * the names and ids as the API reported them, because the fixture is what makes the at-limit case a
 * reproduction rather than an illustration.
 *
 * Four rules are proved here: the refusal at the ceiling names the branches instead of pasting the
 * 422, the newest preserved state per parent is kept, a preserved state older than the age limit is
 * not, and nothing is deleted below the limit. The list of branches this job may never touch —
 * `production`, `demo`, `demo-base`, `DEMO_KEEP_BRANCHES` and the four experiment branches — is
 * proved separately, because "the prune deleted the owner's work" is the failure that ends this
 * policy rather than fixing it.
 */
import { describe, expect, it } from "vitest";

import {
  branchLimit,
  capacityRefusal,
  DEFAULT_BRANCH_LIMIT,
  EXPERIMENT_BRANCHES,
  KIND,
  keepList,
  parsePreserved,
  preservedMaxAgeDays,
  prunePlan,
  prunePreservedBranches,
} from "../scripts/demo-branch-prune.mjs";

type Branch = { id: string; name: string; parent_id?: string | null; default?: boolean };

/** `2026-11-12T16:00:00Z` — the moment the last failing run would have pruned. */
const now = new Date(Date.UTC(2026, 10, 12, 16, 0, 0));

/** The live project, as `GET /projects/{id}/branches` reported it on 2026-11-12. */
function project(): Branch[] {
  return [
    { id: "br-lively-band-b4nryyen", name: "production", parent_id: null, default: true },
    { id: "br-wispy-frog-b43188n8", name: "demo", parent_id: "br-lively-river-b4ymt4cd" },
    { id: "br-lively-river-b4ymt4cd", name: "demo-base", parent_id: "br-lively-band-b4nryyen" },
    {
      id: "br-orange-moon-b4phidxh",
      name: "production-preserved-20261112-135931",
      parent_id: "br-lively-band-b4nryyen",
    },
    {
      id: "br-dry-voice-b4cxbg3t",
      name: "production-preserved-20261107-195905",
      parent_id: "br-lively-band-b4nryyen",
    },
    {
      id: "br-nameless-sky-b4ot4qk5",
      name: "demo-preserved-20261106-111855",
      parent_id: "br-lively-river-b4ymt4cd",
    },
    { id: "br-autumn-king-b44ehnbf", name: "coach-card", parent_id: "br-nameless-sky-b4ot4qk5" },
    {
      id: "br-plain-math-b4wo5sp4",
      name: "rel-schema-533-p1",
      parent_id: "br-lively-river-b4ymt4cd",
    },
    {
      id: "br-raspy-morning-b4sudxpd",
      name: "initiator-crud-533-p2",
      parent_id: "br-lively-river-b4ymt4cd",
    },
    { id: "br-flat-queen-b44s2jnp", name: "lapse-533-p3", parent_id: "br-lively-river-b4ymt4cd" },
  ];
}

const names = (rows: { name: string }[]) => rows.map((row) => row.name);

describe("the policy against the live branch list", () => {
  it("prunes the superseded production recovery point, because a newer one exists", () => {
    const plan = prunePlan({ branches: project(), now });

    expect(names(plan.candidates)).toEqual(["production-preserved-20261107-195905"]);
    expect(plan.candidates[0].kind).toBe(KIND.superseded);
    // The reason says which branch is the newer one, so the log is actionable without the API.
    expect(plan.candidates[0].reason).toContain("production-preserved-20261112-135931");
  });

  it("keeps the demo's only preserved state: it is the newest for its parent and 6 days old", () => {
    const plan = prunePlan({ branches: project(), now });
    const keptDemo = plan.kept.find((row) => row.name === "demo-preserved-20261106-111855");

    expect(keptDemo?.kind).toBe(KIND.newestPreserved);
    expect(keptDemo?.reason).toContain("6 day(s) old");
  });

  it("keeps every core branch, the default branch and the experiment branches", () => {
    const plan = prunePlan({ branches: project(), now });

    // `production` is matched by the default flag first — the strongest reason wins, and it is the
    // one that survives a renamed default branch.
    expect(plan.kept.find((row) => row.name === "production")?.kind).toBe(KIND.default);
    for (const name of ["demo", "demo-base"]) {
      expect(plan.kept.find((row) => row.name === name)?.kind).toBe(KIND.core);
    }
    for (const name of EXPERIMENT_BRANCHES) {
      expect(plan.kept.find((row) => row.name === name)?.kind).toBe(KIND.experiment);
      expect(names(plan.candidates)).not.toContain(name);
    }
    // The four experiments are named in the code precisely so this stays true: they are a quarter
    // of the ceiling and not one of them is a snapshot this job created.
    expect(plan.candidates).toHaveLength(1);
  });

  it("keeps a branch named in DEMO_KEEP_BRANCHES even though it is superseded", () => {
    const plan = prunePlan({
      branches: project(),
      now,
      keep: ["production-preserved-20261107-195905"],
    });

    expect(plan.candidates).toHaveLength(0);
    expect(plan.kept.find((row) => row.name === "production-preserved-20261107-195905")?.kind).toBe(
      KIND.keepList,
    );
  });

  it("prunes a preserved state older than the age limit even when it is the newest", () => {
    const branches = [
      ...project(),
      {
        id: "br-aged",
        name: "demo-base-preserved-20261001-000000",
        parent_id: "br-lively-river-b4ymt4cd",
      },
    ];

    const plan = prunePlan({ branches, now });

    const aged = plan.candidates.find((row) => row.name === "demo-base-preserved-20261001-000000");
    expect(aged?.kind).toBe(KIND.aged);
    expect(aged?.reason).toContain("older than 7 day(s)");
    // 42 days old and still the only preserved state for `demo-base` — the age rule is what
    // retires it, not the newest-per-parent rule.
    expect(plan.kept.find((row) => row.name === "demo-base-preserved-20261001-000000")).toBe(
      undefined,
    );
  });

  it("keeps a name that only looks like a preserved branch", () => {
    const branches = [
      ...project(),
      { id: "br-typo", name: "demo-preserved-20261340-999999", parent_id: null },
      { id: "br-copy", name: "demo-preserved", parent_id: null },
    ];

    const plan = prunePlan({ branches, now });

    expect(plan.candidates).toHaveLength(1);
    expect(plan.kept.find((row) => row.name === "demo-preserved-20261340-999999")?.kind).toBe(
      KIND.notPreserved,
    );
    expect(plan.kept.find((row) => row.name === "demo-preserved")?.kind).toBe(KIND.notPreserved);
  });

  it("does not prune anything below the limit", () => {
    const plan = prunePlan({ branches: project().slice(0, 3), now });

    expect(plan.count).toBe(3);
    expect(plan.free).toBe(DEFAULT_BRANCH_LIMIT - 3);
    expect(plan.candidates).toHaveLength(0);
    expect(
      capacityRefusal({ branchName: "demo", count: plan.count, ceiling: plan.ceiling }),
    ).toBeNull();
  });
});

describe("the capacity pre-flight", () => {
  it("refuses at the ceiling and names the count, the ceiling and the branch to retire", () => {
    const plan = prunePlan({ branches: project(), now });
    const refusal = capacityRefusal({
      branchName: "demo",
      count: plan.count,
      ceiling: plan.ceiling,
      prunable: plan.candidates,
      kept: plan.kept,
    });

    expect(refusal).not.toBeNull();
    // The numbers, so nobody has to count branches in the console.
    expect(refusal).toContain("holds 10 branch(es)");
    expect(refusal).toContain("its limit is 10");
    // The branch, with the reason it is the one to go.
    expect(refusal).toContain("production-preserved-20261107-195905");
    // And why the rest are not, so the next reader does not delete an experiment branch.
    expect(refusal).toContain("coach-card");
    expect(refusal).toContain("DEMO_KEEP_BRANCHES");
    // A refusal is not a half-run.
    expect(refusal).toContain("Nothing was changed.");
  });

  it("says so when the ceiling is held by branches no policy may touch", () => {
    const plan = prunePlan({
      branches: [...project(), { id: "br-extra", name: "manual-experiment", parent_id: null }],
      now,
      keep: ["production-preserved-20261107-195905"],
    });
    const refusal = capacityRefusal({
      branchName: "demo",
      count: plan.count,
      ceiling: plan.ceiling,
      prunable: plan.candidates,
      kept: plan.kept,
    });

    expect(refusal).toContain(
      "no branch in this project is prunable by the preserved-branch policy",
    );
  });

  it("counts the preserved branch a children restore creates, when the caller says so", () => {
    // Nine branches, one free slot: enough for a plain restore, not for a restore that also
    // preserves the target's state under a new branch.
    const count = 9;
    expect(capacityRefusal({ branchName: "demo", count, ceiling: 10 })).toBeNull();
    expect(capacityRefusal({ branchName: "demo", count, ceiling: 10, needed: 2 })).toContain(
      "needs 2 free slot(s)",
    );
  });

  it("honours a ceiling the plan does not share", () => {
    expect(capacityRefusal({ branchName: "demo", count: 9, ceiling: 9 })).toContain(
      "its limit is 9",
    );
  });
});

describe("the prune itself", () => {
  /** A fake API over a mutable array, recording every call so a test can assert what was issued. */
  function fakeApi(branches: Branch[], failOn: string[] = []) {
    const calls: { method: string; path: string }[] = [];
    const call = async (method: string, path: string) => {
      calls.push({ method, path });
      const deleted = branches.find((branch) => path.endsWith(`/branches/${branch.id}`));
      if (deleted !== undefined && failOn.includes(deleted.name)) {
        throw new Error(`DELETE ${path} answered HTTP 500 — boom`);
      }
      return {};
    };
    return { call, calls };
  }

  it("deletes exactly the branches the plan named, and nothing else", async () => {
    const branches = project();
    const plan = prunePlan({ branches, now });
    const api = fakeApi(branches);

    const result = await prunePreservedBranches({
      projectId: "fragrant-glade",
      plan,
      call: api.call,
    });

    expect(result.failed).toEqual([]);
    expect(names(result.deleted)).toEqual(["production-preserved-20261107-195905"]);
    expect(api.calls).toEqual([
      { method: "DELETE", path: "/projects/fragrant-glade/branches/br-dry-voice-b4cxbg3t" },
    ]);
  });

  it("issues no call at all in a dry run", async () => {
    const plan = prunePlan({ branches: project(), now });
    const api = fakeApi(project());

    const result = await prunePreservedBranches({
      projectId: "fragrant-glade",
      plan,
      call: api.call,
      dryRun: true,
    });

    expect(result.deleted).toEqual([]);
    expect(api.calls).toEqual([]);
  });

  it("keeps going after a failed deletion and reports it by name", async () => {
    const branches = project();
    const plan = prunePlan({ branches, now });
    // Two candidates, the first one failing: the run must still free the second slot.
    plan.candidates.push({
      id: "br-second",
      name: "production-preserved-20261101-000000",
      kind: KIND.superseded,
      at: new Date(Date.UTC(2026, 10, 1)),
      reason: 'not the newest preserved state for "production"',
    });
    const api = fakeApi(branches, ["production-preserved-20261107-195905"]);

    const result = await prunePreservedBranches({ projectId: "p", plan, call: api.call });

    expect(names(result.failed)).toEqual(["production-preserved-20261107-195905"]);
    expect(result.failed[0].error).toContain("HTTP 500");
    expect(names(result.deleted)).toEqual(["production-preserved-20261101-000000"]);
  });
});

describe("the environment knobs", () => {
  it("reads DEMO_KEEP_BRANCHES as commas or whitespace", () => {
    expect(keepList({ DEMO_KEEP_BRANCHES: "a,b  c\n d " })).toEqual(["a", "b", "c", "d"]);
    expect(keepList({})).toEqual([]);
    expect(keepList({ DEMO_KEEP_BRANCHES: " , " })).toEqual([]);
  });

  it("falls back to the plan's ceiling for a bad DEMO_BRANCH_LIMIT", () => {
    expect(branchLimit({})).toBe(DEFAULT_BRANCH_LIMIT);
    expect(branchLimit({ DEMO_BRANCH_LIMIT: "20" })).toBe(20);
    expect(branchLimit({ DEMO_BRANCH_LIMIT: "  " })).toBe(DEFAULT_BRANCH_LIMIT);
    expect(branchLimit({ DEMO_BRANCH_LIMIT: "0" })).toBe(DEFAULT_BRANCH_LIMIT);
    expect(branchLimit({ DEMO_BRANCH_LIMIT: "ten" })).toBe(DEFAULT_BRANCH_LIMIT);
  });

  it("lets the age limit be shortened, including to zero", () => {
    expect(preservedMaxAgeDays({})).toBe(7);
    expect(preservedMaxAgeDays({ DEMO_PRESERVED_MAX_AGE_DAYS: "0" })).toBe(0);
    expect(preservedMaxAgeDays({ DEMO_PRESERVED_MAX_AGE_DAYS: "-3" })).toBe(7);
  });
});

describe("parsePreserved", () => {
  it("reads the stamp and the collision suffix a preserved name carries", () => {
    const parsed = parsePreserved("demo-preserved-20261106-111855-2");

    expect(parsed?.stem).toBe("demo");
    expect(parsed?.at.toISOString()).toBe("2026-11-06T11:18:55.000Z");
    expect(parsed?.collision).toBe(2);
  });

  it("refuses anything that is not one of the names preservedUnderName() builds", () => {
    for (const name of ["demo", "demo-preserved", "demo-preserved-2026", "coach-card"]) {
      expect(parsePreserved(name)).toBeNull();
    }
  });
});
