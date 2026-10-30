/**
 * The demo's source rule, proved without a Neon key, a network call or a fake API (#185 follow-up).
 *
 * `scripts/demo-reset.mjs` resets the `demo` branch from its **parent**, so the parent is the
 * demo's entire supply of data. While that parent was `production`, every nightly reset copied the
 * live branch's runtime rows and real auth accounts onto the branch the public URL serves. The
 * fix is topological — `demo ← demo-base`, a schema-only base — and the check that keeps it that
 * way is `parentRefusal()`, which `assertResettable()` throws from.
 *
 * The case that matters is the negative one: a re-parented branch must be a refusal, not a
 * warning, because "someone will remember" is what produced the exposure in the first place.
 */
import { describe, expect, it } from "vitest";

import { parentRefusal } from "../scripts/demo-parent-guard.mjs";

/** A branch shaped the way `resolveBranch()` in `scripts/demo-reset.mjs` returns it. */
function branch(overrides: Record<string, string | null>) {
  return {
    id: "br-demo-0001",
    name: "demo",
    parentId: "br-base-0002",
    parentName: "demo-base",
    defaultBranchId: "br-production-0003",
    defaultBranchName: "production",
    ...overrides,
  };
}

describe("the demo's reset source", () => {
  it("refuses a parent that is the project's default branch", () => {
    const refusal = parentRefusal(
      branch({
        parentId: "br-production-0003",
        parentName: "production",
      }),
    );

    expect(refusal).not.toBeNull();
    // The message has to name the actual problem: the source, not the target.
    expect(refusal).toContain("schema-only base branch");
    expect(refusal).toContain('"production"');
    // And it has to say the run did nothing, so nobody goes looking for a half-applied reset.
    expect(refusal).toContain("Nothing was changed.");
  });

  it("passes a parent that is a named base branch", () => {
    expect(parentRefusal(branch({}))).toBeNull();
  });

  it("leaves the no-parent refusal to the check that owns it", () => {
    // A root branch is refused by `assertResettable`'s own sentence; returning null here keeps one
    // rule per case instead of two that can disagree.
    expect(parentRefusal(branch({ parentId: null, parentName: null }))).toBeNull();
  });
});
