/**
 * The restore request's body, proved without a Neon key or a network call (t_d39323cc).
 *
 * The nightly `Demo reset` job died on
 * `POST …/branches/br-wispy-frog-b43188n8/restore answered HTTP 422 — Branch has children,
 * preserve_under_name is required`: the demo branch has children, and the API refuses a restore of
 * such a branch unless the body says where to preserve them. The two things that have to be right
 * are both pure and both here — the parameter is sent when (and only when) the branch has children,
 * and the name it carries is unique, safe and short enough for the API to accept.
 *
 * The "and only when" half is not tidiness: `preserve_under_name` creates a branch, so sending it
 * on every run would leave a preserved branch behind every night. The first restore moves the
 * children under the preserved branch, so the demo branch has none afterwards and the second run's
 * body is the plain one — which is the case asserted at the bottom.
 */
import { describe, expect, it } from "vitest";

import { preservedUnderName, restoreRequest, stampFor } from "../scripts/demo-restore-plan.mjs";

type Child = { id: string; name: string };
type Branch = { id: string; name: string; children?: Child[]; allNames?: string[] };
type Source = { id: string };

/** `2026-11-06T16:31:46Z` — the instant the failing run's restore was sent. */
const at = new Date(Date.UTC(2026, 10, 6, 16, 31, 46));

const source: Source = { id: "br-lively-river-b4ymt4cd" };

function branch(overrides: Partial<Branch> = {}): Branch {
  return { id: "br-wispy-frog-b43188n8", name: "demo", ...overrides };
}

/** A child shaped the way `resolveBranch()` reports one. */
const child: Child = { id: "br-preview-x", name: "preview-x" };

describe("the restore request for the demo branch", () => {
  it("sends preserve_under_name when the branch has children", () => {
    const plan = restoreRequest(branch({ children: [child] }), source, at);

    expect(plan.body.source_branch_id).toBe(source.id);
    expect(plan.body.preserve_under_name).toBe("demo-preserved-20261106-163146");
    // The name is reported back so the run log can say which branch holds the old state.
    expect(plan.preservedUnder).toBe("demo-preserved-20261106-163146");
  });

  it("reports which children will move, so the log names them", () => {
    const plan = restoreRequest(
      branch({
        children: [child, { id: "br-preview-y", name: "preview-y" }],
      }),
      source,
      at,
    );

    expect(plan.children.map((entry) => entry.name)).toEqual(["preview-x", "preview-y"]);
  });

  it("sends the plain body when the branch has no children", () => {
    const plan = restoreRequest(branch({ children: [] }), source, at);

    // Exactly the pre-fix body: an unnecessary preserve_under_name would create a branch nightly.
    expect(plan.body).toEqual({ source_branch_id: source.id });
    expect(plan.body).not.toHaveProperty("preserve_under_name");
    expect(plan.preservedUnder).toBeNull();
  });

  it("treats a branch with no children field the same as no children", () => {
    // `resolveBranch()` always sets it; a branch resolved elsewhere may not.
    expect(restoreRequest(branch(), source, at).body).toEqual({ source_branch_id: source.id });
  });

  it("converges: after the children move, the next run's body is the plain one", () => {
    // The API moves every child under the preserved branch, so the same target handed back with
    // the children gone (which is what `resolveBranch()` re-resolves after the restore) needs no
    // parameter at all — the repair happens once, not every night.
    const afterRepair = restoreRequest(branch({ children: [] }), source, at);

    expect(afterRepair.body).toEqual({ source_branch_id: source.id });
    expect(afterRepair.preservedUnder).toBeNull();
  });
});

describe("the name the pre-reset state is preserved under", () => {
  const taken = (names: string[]) => branch({ children: [child], allNames: names });

  it("carries the instant, so two runs cannot pick the same name", () => {
    const first = preservedUnderName("demo", at);
    const second = preservedUnderName("demo", new Date(at.getTime() + 1000));

    expect(first).toBe("demo-preserved-20261106-163146");
    expect(second).toBe("demo-preserved-20261106-163147");
    expect(first).not.toBe(second);
  });

  it("steps around a name the project already has, instead of failing on a 409", () => {
    const base = "demo-preserved-20261106-163146";
    expect(preservedUnderName("demo", at, [base])).toBe(`${base}-2`);
    expect(preservedUnderName("demo", at, [base, `${base}-2`])).toBe(`${base}-3`);
  });

  it("steps around a collision in the body it actually sends", () => {
    const plan = restoreRequest(taken(["demo-preserved-20261106-163146"]), source, at);

    expect(plan.body.preserve_under_name).toBe("demo-preserved-20261106-163146-2");
  });

  it("folds characters Neon refuses in a branch name", () => {
    // A branch name is data from the API, not a literal: `demo scratch/2` is not a legal name.
    expect(preservedUnderName("demo scratch/2", at)).toBe(
      "demo-scratch-2-preserved-20261106-163146",
    );
  });

  it("keeps the name inside Neon's 63-character limit, cutting the stem and never the stamp", () => {
    const name = preservedUnderName("d".repeat(200), at);

    expect(name.length).toBeLessThanOrEqual(63);
    expect(name.endsWith("-preserved-20261106-163146")).toBe(true);
  });

  it("never returns a name with nothing in front of the stamp", () => {
    expect(preservedUnderName("///", at)).toBe("demo-preserved-20261106-163146");
  });

  it("stamps UTC, not the runner's local time", () => {
    // A runner in another zone must not produce a different name for the same instant.
    const utc = new Date(Date.UTC(2026, 0, 2, 3, 4, 5));

    expect(stampFor(utc)).toBe("20260102-030405");
    expect(preservedUnderName("demo", utc)).toBe("demo-preserved-20260102-030405");
  });
});
