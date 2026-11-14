/**
 * #683 — the worktree pruner's decision table, case by case.
 *
 * `scripts/worktree-prune-rules.ts` is the half that decides; `scripts/worktree-prune.mjs` is the
 * half that reads git and the kanban database. Everything below exercises the decision alone, which
 * is the point: the conditions that *refuse* a removal are the load-bearing ones, and a repository
 * cannot be arranged to prove them on demand.
 *
 * The three conditions the brief names are the remove case. Every keep case below is a worktree that
 * would have been swept by the manual `git worktree list` sweep this replaces: a dirty tree, a branch
 * whose work never landed, a card still running, a detached scratch tree, and — the expensive one —
 * the primary checkout, which is registered like any other worktree and is routinely matched to a
 * finished card.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decideWorktree,
  EXCLUDED_PATHS,
  type MergeWitness,
  type WorktreeFacts,
} from "../worktree-prune-rules";

/** A worktree that passes all three conditions; each case below spoils exactly one fact. */
function facts(overrides: Partial<WorktreeFacts> = {}): WorktreeFacts {
  return {
    path: "/repo/.worktrees/t_110c7cf5",
    relativePath: ".worktrees/t_110c7cf5",
    branch: "alignsynch/t_110c7cf5-build-library-743",
    headSha: "1f2e3d4c5b6a7980",
    isPrimary: false,
    isCwd: false,
    underWorktreesDir: true,
    locked: false,
    prunable: false,
    cards: [{ id: "t_110c7cf5", status: "done" }],
    dirtyFiles: 0,
    witness: "patch",
    mergedAs: "1e471674160992d7028e23abdbd7abdda6acaf60",
    ...overrides,
  };
}

describe("worktree-prune: the one case that removes", () => {
  it("removes a finished card, clean tree, and a squashed patch on origin/main", () => {
    const decision = decideWorktree(facts());
    assert.equal(decision.action, "remove");
    assert.match(decision.reason, /patch on origin\/main as 1e471674/);
    assert.match(decision.reason, /tree clean/);
  });

  it("removes an archived card too, and names the ancestry proof when that is the witness", () => {
    const decision = decideWorktree(
      facts({
        branch: "wt/release-1.20.0",
        relativePath: ".worktrees/t_f7149e33",
        path: "/repo/.worktrees/t_f7149e33",
        cards: [{ id: "t_f7149e33", status: "archived" }],
        witness: "ancestor",
        mergedAs: null,
      }),
    );
    assert.equal(decision.action, "remove");
    assert.match(decision.reason, /t_f7149e33 \(archived\)/);
    assert.match(decision.reason, /ancestor of origin\/main/);
  });

  it("removes a branch carrying no change at all — nothing in it could be lost", () => {
    const decision = decideWorktree(facts({ witness: "no-delta", mergedAs: null }));
    assert.equal(decision.action, "remove");
    assert.match(decision.reason, /carries no change/);
  });

  it("names every card that claims the path, because a shared workspace is still one decision", () => {
    const decision = decideWorktree(
      facts({
        cards: [
          { id: "t_d63d5739", status: "done" },
          { id: "t_c6225823", status: "done" },
        ],
      }),
    );
    assert.equal(decision.action, "remove");
    assert.match(decision.reason, /t_d63d5739 \(done\), t_c6225823 \(done\)/);
  });
});

describe("worktree-prune: a dirty tree is never swept", () => {
  it("keeps a worktree holding one changed path, and counts it", () => {
    const decision = decideWorktree(facts({ dirtyFiles: 1 }));
    assert.equal(decision.action, "keep");
    assert.match(decision.reason, /tree is dirty \(1 changed path/);
  });

  it("keeps a worktree holding many, with the count and the word plural", () => {
    const decision = decideWorktree(facts({ dirtyFiles: 14 }));
    assert.equal(decision.action, "keep");
    assert.match(decision.reason, /14 changed paths/);
    assert.match(decision.reason, /untracked included/);
  });

  it("keeps a tree it could not read rather than assuming it is clean", () => {
    const decision = decideWorktree(facts({ dirtyFiles: null }));
    assert.equal(decision.action, "keep");
    assert.match(decision.reason, /could not be read/);
  });
});

describe("worktree-prune: an unmerged branch is never swept", () => {
  it("keeps a branch with no ancestry and no squashed patch on origin/main", () => {
    const decision = decideWorktree(facts({ witness: "none", mergedAs: null }));
    assert.equal(decision.action, "keep");
    assert.match(decision.reason, /is not on origin\/main and no squashed patch was found/);
    assert.match(decision.reason, /alignsynch\/t_110c7cf5-build-library-743/);
  });

  it("keeps a branch whose merge state could not be tested at all", () => {
    const witnesses: MergeWitness[] = ["unknown"];
    for (const witness of witnesses) {
      const decision = decideWorktree(facts({ witness, mergedAs: null }));
      assert.equal(decision.action, "keep");
      assert.match(decision.reason, /could not test the branch against origin\/main/);
    }
  });
});

describe("worktree-prune: an unfinished card is the crash-recovery path", () => {
  it("keeps a worktree whose card is still running", () => {
    const decision = decideWorktree(facts({ cards: [{ id: "t_156a1bb1", status: "running" }] }));
    assert.equal(decision.action, "keep");
    assert.match(decision.reason, /card t_156a1bb1 is running/);
  });

  it("keeps it even when a second card on the same path is done", () => {
    const decision = decideWorktree(
      facts({
        cards: [
          { id: "t_c6225823", status: "done" },
          { id: "t_d63d5739", status: "todo" },
        ],
      }),
    );
    assert.equal(decision.action, "keep");
    assert.match(decision.reason, /card t_d63d5739 is todo/);
  });

  it("keeps a path no card claims, because nobody is left to say the work shipped", () => {
    const decision = decideWorktree(
      facts({ cards: [], relativePath: ".worktrees/brand-quizhub-3001" }),
    );
    assert.equal(decision.action, "keep");
    assert.match(decision.reason, /no card owns this path \(brand-quizhub-3001\)/);
  });
});

describe("worktree-prune: the guard rails around the sweep", () => {
  it("never removes the primary checkout, even when a finished card claims it", () => {
    const decision = decideWorktree(
      facts({
        path: "/repo",
        relativePath: "",
        isPrimary: true,
        branch: "main",
        cards: [{ id: "t_4129f831", status: "done" }],
      }),
    );
    assert.equal(decision.action, "keep");
    assert.match(decision.reason, /primary checkout/);
  });

  it("never removes the worktree the command is running in", () => {
    const decision = decideWorktree(facts({ isCwd: true }));
    assert.equal(decision.action, "keep");
    assert.match(decision.reason, /running in/);
  });

  it("preserves the v1.20.0 prep by path", () => {
    const decision = decideWorktree(
      facts({
        path: "/repo/.worktrees/t_3eb17cf8",
        relativePath: ".worktrees/t_3eb17cf8",
        branch: "wt/release-1.20.0",
        cards: [{ id: "t_3eb17cf8", status: "archived" }],
        witness: "ancestor",
        dirtyFiles: 4,
      }),
      EXCLUDED_PATHS,
    );
    assert.equal(decision.action, "keep");
    assert.match(decision.reason, /excluded by path/);
  });

  it("excludes an exact path, not a prefix of one", () => {
    const decision = decideWorktree(
      facts({
        path: "/repo/.worktrees/t_3eb17cf80",
        relativePath: ".worktrees/t_3eb17cf80",
        cards: [{ id: "t_3eb17cf80", status: "done" }],
      }),
      EXCLUDED_PATHS,
    );
    assert.equal(decision.action, "remove");
  });

  it("leaves registrations outside .worktrees/ alone", () => {
    const decision = decideWorktree(
      facts({
        path: "/home/dev/scratch/rel-main-1-17-1",
        relativePath: "../scratch/rel-main-1-17-1",
        underWorktreesDir: false,
      }),
    );
    assert.equal(decision.action, "keep");
    assert.match(decision.reason, /outside \.worktrees\//);
  });

  it("keeps a detached HEAD: there is no branch whose merge could be proved", () => {
    const decision = decideWorktree(facts({ branch: null }));
    assert.equal(decision.action, "keep");
    assert.match(decision.reason, /detached HEAD/);
  });

  it("keeps a locked registration and one whose directory is already gone", () => {
    assert.equal(decideWorktree(facts({ locked: true })).action, "keep");
    assert.match(decideWorktree(facts({ locked: true })).reason, /locked/);

    const prunable = decideWorktree(facts({ prunable: true }));
    assert.equal(prunable.action, "keep");
    assert.match(prunable.reason, /git worktree prune/);
  });

  it("honours an extra exclusion passed at the command line", () => {
    const decision = decideWorktree(facts(), [...EXCLUDED_PATHS, ".worktrees/t_110c7cf5"]);
    assert.equal(decision.action, "keep");
    assert.match(decision.reason, /excluded by path/);
  });
});
