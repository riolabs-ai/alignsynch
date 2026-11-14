/**
 * The decision half of `scripts/worktree-prune.mjs`: given the facts about one registered worktree,
 * say whether it may be removed and why — or which condition saved it. Pure, so the rules are tested
 * without a repository, a git call or a kanban database (`scripts/__tests__/worktree-prune.test.ts`).
 *
 * The three conditions the brief names, in the order they are checked, are: the card is finished
 * (`done` / `archived`), the branch is on `origin/main`, and the tree is clean. Everything else here
 * is a **refusal**, and every refusal returns a sentence rather than a boolean, because the point of
 * the tool is the survivor list: an operator has to be able to read why a worktree stayed.
 *
 * Two of the refusals are not in the brief and exist because a naive sweep destroys work:
 *
 *   - **the primary checkout**, which is a registered worktree like any other and is frequently
 *     matched to a finished card — `git worktree remove` on it deletes the repository;
 *   - **the worktree the command is running in**, whose removal pulls the directory out from under
 *     the running process (the repo's own worktree-hygiene note records a shell left with a dangling
 *     cwd whose every later command fails before it runs).
 *
 * A detached HEAD is also kept, and that is a decision rather than an oversight: `git worktree list`
 * reports detached scratch trees by sha, there is no branch whose merge can be proved, and the only
 * evidence left would be "looks like scratch" — which is exactly the guess this tool refuses.
 */

/** A card that occupies a workspace is eligible only in these states. */
export const FINISHED_CARD_STATUSES: readonly string[] = ["done", "archived"];

/**
 * Worktrees preserved **by explicit path**, never because a condition happened to save them.
 *
 *   `.worktrees/t_3eb17cf8` — the archived v1.20.0 release prep. It carries the v1.20.0 atlas capture
 *   and the regenerated docs nav as uncommitted files, so it is genuinely dirty; the reason it must
 *   never be swept is that the dirty files are the artifact, and the tree is the only copy.
 *
 * Paths are relative to the repository root. Adding an entry here is the supported way to preserve a
 * worktree; the alternative is to make it clean and unmerged, which is a lie in a directory listing.
 */
export const EXCLUDED_PATHS: readonly string[] = [".worktrees/t_3eb17cf8"];

/** How the branch was proved to be on `origin/main`. */
export type MergeWitness = "ancestor" | "patch" | "no-delta" | "none" | "unknown";

/** One card that claims this path as its workspace. */
export interface ClaimingCard {
  readonly id: string;
  readonly status: string;
}

/** Everything the rules need to know about one registered worktree. Nothing here calls git. */
export interface WorktreeFacts {
  /** Absolute path, as `git worktree list --porcelain` prints it. */
  readonly path: string;
  /** Repository-relative path with `/` separators — what `EXCLUDED_PATHS` is written in. */
  readonly relativePath: string;
  /** Short branch name, or `null` when HEAD is detached. */
  readonly branch: string | null;
  /** HEAD sha, used only in the printed proof. */
  readonly headSha: string;
  /** The repository's primary checkout — the one holding `.git/`, never removable. */
  readonly isPrimary: boolean;
  /** The worktree this process is running in, whose directory cannot outlive the process. */
  readonly isCwd: boolean;
  /** Under `<primary>/.worktrees/`, the only place this tool manages. */
  readonly underWorktreesDir: boolean;
  /** A `locked` registration, which git itself refuses to remove. */
  readonly locked: boolean;
  /** A registration whose directory is gone — `git worktree prune` is the right tool, not this one. */
  readonly prunable: boolean;
  /** Every card whose `workspace_path` is exactly this path. */
  readonly cards: readonly ClaimingCard[];
  /** Count of paths `git status --short` reports, or `null` when the tree could not be read. */
  readonly dirtyFiles: number | null;
  /** Whether the branch is on `origin/main`, and how that was proved. */
  readonly witness: MergeWitness;
  /** For `witness: "patch"`, the `origin/main` commit carrying the branch's patch. */
  readonly mergedAs: string | null;
}

/** The verdict, with the sentence an operator reads. */
export interface Decision {
  readonly action: "remove" | "keep";
  readonly reason: string;
}

const keep = (reason: string): Decision => ({ action: "keep", reason });

/** `t_110c7cf5` → `t_110c7cf5`; `.worktrees/t_110c7cf5` → `t_110c7cf5`. */
export function basenameOf(path: string): string {
  const parts = path.split("/").filter((part) => part !== "");
  return parts.at(-1) ?? path;
}

/**
 * Decide one worktree. `exclusions` are repository-relative paths that are preserved on purpose;
 * the caller normalises them, so the comparison here is exact string equality.
 */
export function decideWorktree(
  facts: WorktreeFacts,
  exclusions: readonly string[] = EXCLUDED_PATHS,
): Decision {
  const relativePath = facts.relativePath;

  if (exclusions.includes(relativePath)) {
    return keep("excluded by path — preserved on purpose, never swept");
  }
  if (facts.isPrimary) {
    return keep("the primary checkout — removing it deletes the repository");
  }
  if (facts.isCwd) {
    return keep("the worktree this command is running in");
  }
  if (!facts.underWorktreesDir) {
    return keep("registered outside .worktrees/ — not managed by this script");
  }
  if (facts.prunable) {
    return keep("registration has no directory — `git worktree prune` clears it");
  }
  if (facts.locked) {
    return keep("registration is locked");
  }
  if (facts.cards.length === 0) {
    return keep(
      `no card owns this path (${basenameOf(facts.relativePath === "" ? facts.path : facts.relativePath)})`,
    );
  }

  const unfinished = facts.cards.find((card) => !FINISHED_CARD_STATUSES.includes(card.status));
  if (unfinished !== undefined) {
    return keep(
      `card ${unfinished.id} is ${unfinished.status} — unfinished cards are the crash-recovery path`,
    );
  }
  if (facts.branch === null) {
    return keep("detached HEAD — there is no branch whose merge could be proved");
  }
  if (facts.dirtyFiles === null) {
    return keep("the tree could not be read");
  }
  if (facts.dirtyFiles > 0) {
    const noun = facts.dirtyFiles === 1 ? "path" : "paths";
    return keep(`tree is dirty (${facts.dirtyFiles} changed ${noun}, untracked included)`);
  }
  if (facts.witness === "unknown") {
    return keep("could not test the branch against origin/main");
  }
  if (facts.witness === "none") {
    return keep(`branch ${facts.branch} is not on origin/main and no squashed patch was found`);
  }

  const cardLabel = facts.cards.map((card) => `${card.id} (${card.status})`).join(", ");
  const proof =
    facts.witness === "ancestor"
      ? `${facts.branch} is an ancestor of origin/main`
      : facts.witness === "no-delta"
        ? `${facts.branch} carries no change over its fork point`
        : `patch on origin/main as ${(facts.mergedAs ?? "?").slice(0, 8)}`;
  return {
    action: "remove",
    reason: `card ${cardLabel} · ${proof} · tree clean`,
  };
}
