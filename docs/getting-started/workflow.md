# Request to release — the intake and wave workflow

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Start here** › Request → release · prev [The demo](demo.md)

<!-- docs-nav:end -->

Five stages. A stage that cannot be completed turns the request into a question, not a card.

## 1. Capture

Annotations arrive from the in-app browser with a selector, a screenshot and the owner's note.
**The note is quoted verbatim in the issue.** Never paraphrase it into product language — a
paraphrase is how "Quick Links" became an invented heading. One annotation is one request; a note
carrying two changes is two issues.

## 2. Repeatability — the Stop/Go

Every issue carries **Repro** (`route · which seat is signed in · steps · expected · actual`) and
**Measurement** (the `file:line` that proves the claim, taken from the tree, not from the note). No
repro, no card — the deliverable is the question. A claim that does not reproduce closes with the
evidence that it does not; that is a valid outcome and a cheaper one than a speculative fix.

## 3. Classify depth

Depth decides the gate lane, the review weight, and whether an artifact is owed at all.

| Depth       | What it touches                      | Gate lane               | Review                  | Artifact               |
| ----------- | ------------------------------------ | ----------------------- | ----------------------- | ---------------------- |
| `copy`      | a fixture string, a label, a heading | docs/content, seconds   | the diff                | none                   |
| `component` | one component's markup or classes    | code, full gate         | screenshots at 5 widths | none                   |
| `data`      | a fixture collection, a projection   | content, under a minute | `data:check` delta      | none                   |
| `schema`    | `content/**`, a migration            | code + `db:*`           | V-invariants named      | spec section           |
| `surface`   | a route, a layout, a flow stage      | code, full gate         | before/after + parity   | `docs/specs/<bundle>/` |

## 4. Artifact — one per request, chosen by depth

- **ARD** (`docs/ard/`) only when the request moves architecture or ownership.
- **`docs/specs/<bundle>/`** only when design is the deliverable (`surface` depth).
- **The card body is the implementation plan** in every other case: ordered steps, MUST NOT,
  acceptance command.

## 5. Stack, then cut

Cards live `todo` under one **release-train card** and are released into `ready` in file-collision
order — two or three concurrent, one writer per worktree. The train card is the only thing that
starts a version. The cutoff is mechanical: `release_boundary.py` decides patch vs minor vs fresh
chat, the milestone is the release, and a minor or major cuts in its own session.

## Traps this workflow exists to prevent (all measured on this repo)

- **A duplicate card per decomposition.** An auto-decomposed parent yields children that duplicate
  its own scope; the parent's children cannot promote while the parent sits `todo`. Collapse before
  you fan out.
- **A new branch for an existing PR.** A card whose workspace differs from the PR's branch opens a
  _second_ PR instead of repairing the first. The workspace is part of the spec.
- **A blocked parent does not gate its children.** Archiving the parent releases all of them at
  once; sequence by hand.
- **`scheduled` is a dead end.** Park "human must act" as `blocked` with a decision block; park
  "waiting on cards" as `todo`.
- **`main` moves under a cut.** Gate the head you tag. A merge after `verify.sh` and before
  `release.sh` tags an unverified tree.
- **A dirty shared checkout reads as a working gate.** Match on the process's own `cwd`, not on a
  string in someone else's command line.

## See also

- [Iteration rhythm](../operations/iteration.md) — the inner loop, `check:fast` against the full gate.
- [Repo layers](../operations/repo-layers.md) — the lane classifier that makes the depth table pay.
- [The gate](../operations/gate.md) — what `scripts/verify.sh` runs, in order, and its current numbers.
- [Releasing](../operations/releasing.md) — the eight steps that turn a green `main` into a version.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Start here** › Request → release · prev [The demo](demo.md)

<!-- docs-nav:end -->
