/**
 * The demo's source rule, proved without a Neon key, a network call or a fake API (#185 follow-up).
 *
 * `scripts/demo-reset.mjs` restores the `demo` branch from a **source branch**, so the source is
 * the demo's entire supply of data. While that source was `production`, every nightly reset copied
 * the live branch's runtime rows and real auth accounts onto the branch the public URL serves. The
 * source is now `demo-base`, a schema-only base — and the check that keeps it that way is
 * `sourceRefusal()`, which `assertSourceResettable()` throws from.
 *
 * The rule is about the **source**, not the branch's parent, and the case that proves it is the
 * second one below: the live `demo` branch *has* `production` for a parent (Neon does not allow a
 * branch to be re-parented through the API) and is still reset from `demo-base`. A guard that
 * looked at the parent would refuse every scheduled run; a guard that looks at the source refuses
 * exactly the thing that matters, a source that is the default branch.
 *
 * The other case that matters is the negative one: a source pointed back at the default branch
 * must be a refusal, not a warning, because "someone will remember" is what produced the exposure
 * in the first place.
 */
import { describe, expect, it } from "vitest";

import { sourceRefusal } from "../scripts/demo-source-guard.mjs";

/** A source shaped the way `resolveSource()` in `scripts/demo-reset.mjs` returns it. */
type Source = {
  id: string;
  name: string;
  requested: boolean;
  defaultBranchId: string | null;
};

function source(overrides: Partial<Source> = {}): Source {
  return {
    id: "br-base-0002",
    name: "demo-base",
    requested: true,
    defaultBranchId: "br-production-0003",
    ...overrides,
  };
}

/** The branch being reset, shaped the way `resolveBranch()` returns it. */
const demo = { id: "br-demo-0001", name: "demo" };

describe("the demo's reset source", () => {
  it("refuses a source that is the project's default branch", () => {
    const refusal = sourceRefusal(
      demo,
      source({ id: "br-production-0003", name: "production", requested: true }),
    );

    expect(refusal).not.toBeNull();
    // The message has to name the actual problem: the source, not the target.
    expect(refusal).toContain("schema-only base branch");
    expect(refusal).toContain('"production"');
    // And the fix has to be the one that exists — the source is named now, not re-parented.
    expect(refusal).toContain("DEMO_SOURCE_BRANCH");
    // And it has to say the run did nothing, so nobody goes looking for a half-applied reset.
    expect(refusal).toContain("Nothing was changed.");
  });

  it("refuses the parent when it is the default branch, for the same reason", () => {
    // Nothing names the source, so `resolveSource()` falls back to the parent — which for a demo
    // cut before `demo-base` existed is `production`. Same guarantee, different sentence.
    const refusal = sourceRefusal(
      demo,
      source({ id: "br-production-0003", name: "production", requested: false }),
    );

    expect(refusal).not.toBeNull();
    expect(refusal).toContain("its parent");
    expect(refusal).toContain("Nothing was changed.");
  });

  it("passes a source that is a named base branch", () => {
    expect(sourceRefusal(demo, source({}))).toBeNull();
  });

  it("passes the live topology: a target whose parent is the default branch, reset from demo-base", () => {
    // `demo` (br-wispy-frog-b43188n8) still has `production` for a parent and cannot be
    // re-parented; only the source decides where the rows come from, so this must pass.
    expect(
      sourceRefusal(
        demo,
        source({ id: "br-lively-river-b4ymt4cd", name: "demo-base", requested: true }),
      ),
    ).toBeNull();
  });

  it("refuses by id, whatever the default branch is called", () => {
    // A renamed default is still refused: the comparison is the API's `default` flag, not a name.
    const refusal = sourceRefusal(
      demo,
      source({ id: "br-production-0003", name: "main", requested: true }),
    );

    expect(refusal).not.toBeNull();
    expect(refusal).toContain('"main"');
  });
});
