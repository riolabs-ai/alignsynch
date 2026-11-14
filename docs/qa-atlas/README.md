# QA atlas

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › QA atlas · prev [v1.x UI cohort](../qa/v1x-ui-cohort/README.md) · next [QA atlas — v1.17.0](v1.17.0/index.md)

<!-- docs-nav:end -->

One document per release that answers the question a hash cannot: **does every surface still render
the record it claims?**

`pnpm parity` hashes seven routes and the gate builds one. Neither notices a page that renders
beautifully and reads the wrong record — #936 did exactly that. So the atlas walks every route
`data/pages/budget.ts` registers through a real browser, at three widths, and asserts four things per
capture:

| assertion | how                                                                                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| status    | the response code against the brand boundary (`tests/parity/boundary.ts` + the page's own gate call) — `404` where the build does not claim the product               |
| console   | no console error, and React's hydration mismatch (`#418`) specifically                                                                                                |
| headline  | a heading string out of the route's own copy fixture is in the DOM — the words come from `data/pages/<surface>.ts`, so a page reading another record cannot show them |
| main      | a `main` subtree with real content under it, not an empty shell                                                                                                       |

A route that fails one is reported **as a failure in the atlas**, and its screenshot is kept as the
evidence of the failure.

## What is committed, and what is not

- **Committed:** 480 px WebP thumbnails, `manifest.json` and the markdown. The whole directory is
  held to **≤ 5 MB** by the check.
- **Not committed:** the full-size PNG set. `pnpm qa:atlas` packs them into
  `qa-atlas-v<version>-full-size.zip`, which is attached to that version's GitHub Release and linked
  from the atlas page. A release whose assets are immutable cannot take one — `gh release upload`
  answers `HTTP 422` — so the page names the archive and its sha256 instead of linking a 404.

## Retention — the window, and the check that holds it

The atlas is a picture of a release, not an archive of the product. The owner's rule (2026-11-14):

> Drop or delete all atlas versions except the current and the 2 past cuts — 1 past if the tree is
> too bulky. Hold that window until we have a finished production release fit for official launch.

**The window is a number, not a judgement.** `scripts/qa-atlas-retention.mjs` is its one home:

| term              | value                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| window            | the **current cut + 2 past** — three directories                                                              |
| bulky             | a cut the window would keep is **over 4 MB** (a capture is ~1.7 MB today, so this is roughly a doubling)      |
| window when bulky | the **current cut + 1 past** — two directories                                                                |
| counts as a cut   | a directory named `v<major>.<minor>.<patch>` under `docs/qa-atlas/`; a cut with no `manifest.json` counts too |

The threshold is applied to the cuts that **stay**: a 9 MB cut that is about to be pruned does not
narrow the window on its way out, because the window describes what the tree holds afterwards.

**Measured on `main` (`180b0802`): three cuts, 5.06 MB** — nothing to prune, and nothing was
deleted to get here.

| cut       | weight  | role                                                                            |
| --------- | ------- | ------------------------------------------------------------------------------- |
| `v1.18.0` | 1.73 MB | **current** — the version `package.json` carries                                |
| `v1.17.1` | 1.72 MB | past #1 — the label was never a release ([its page](v1.17.1/index.md) says why) |
| `v1.17.0` | 1.61 MB | past #2                                                                         |

Two commands, and only one of them runs in the gate:

```bash
pnpm qa:atlas:check   # a gate step: FAILS when the tree holds more cuts than the window
pnpm qa:atlas:prune   # removes them with `git rm -r`; NEVER a gate step
```

`qa:atlas:check` fails by name — it lists every cut past the window and prints the command that
removes it. `qa:atlas:prune` applies the same window, but it is deliberately **not** a step in
`scripts/verify.sh`: a gate that deletes files is a gate that can delete the wrong files, and the
gate runs on every push, unattended. It prints the keep/remove plan before touching anything, and it
**refuses** — exit 2, nothing removed — when:

- the newest cut's directory is not `v` + the version `package.json` carries. The window is counted
  from the newest directory, so pruning against a mislabelled head retires the capture for the
  release being cut — that refusal is the whole reason the mode exists;
- a cut it would remove is not tracked by git (a directory that got there by accident is a human's
  deletion, not a retention script's);
- the tree holds no cut at all — a prune that reports success over an empty atlas is worse than one
  that refuses.

After removing a cut it drops that cut's rows from `docs/docs.json` and refreshes the nav, because a
pruned cut left in the manifest is a `pnpm docs:check` failure one lane over.

## The launch criterion

The window holds until the atlas says a release is fit to launch. **A release is eligible for
official launch when the latest atlas cut reports 0 failing surfaces and every skip is explained in
the index.** Both halves matter: a failure is a surface that did not render the record it claims,
and an unexplained skip is a surface nobody looked at.

**Today's newest cut, `v1.18.0`, does not meet that bar, and this page will not pretend otherwise.**
It reports **77 registry surfaces · 74 routes · 71 captured · 3 failing · 3 skipped**:

| surface                                   | verdict                                                             |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `/assessment/instances/[instanceId]/sent` | 500, where the boundary table expects 200                           |
| `/admin/instances/[id]`                   | 200, with a console error (a controlled/uncontrolled input warning) |
| `/categories`                             | 404, and the body is not the app's not-found copy                   |

All three skips do carry their reason in that cut's index (`/reset/[token]`,
`/dashboard/templates/[id]`, `/invite/[token]`), so the skip half of the criterion is satisfied and
the failure half is not. The atlas is working exactly as intended here — it is reporting the product
honestly, and the gate passes because publishing a real mismatch is its job. Launch eligibility is a
statement about the **product**, not about this document.

## Running a capture

The capture needs a running server and the demo branch's own rows, which is why it is **not** a gate
step. The static half is.

```bash
export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"

# 1. the demo identities — the signed-in passes sign in as these, so a branch with no
#    demo_account row captures the public surfaces only and records the rest as skipped
DEMO_AUTH=1 pnpm db:seed:demo

# 2. a server carrying the demo branch's DATABASE_URL (withenv exports .env/.env.local)
~/.hermes/profiles/alignsynch/bin/withenv.sh <repo> bash -c \
  'cd <worktree> && export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH" BRAND=alignsynch &&
   exec pnpm dev --port 3411 --hostname 127.0.0.1'

# 3. the capture, in another shell
QA_ATLAS_BASE=http://127.0.0.1:3411 pnpm qa:atlas
```

Flags for iterating: `--only=<route>`, `--width=<n>`, `--role=<public|member|admin>`,
`--out=<dir>` (a dry run), `--no-zip`. The run refuses `NEON_BRANCH=production`, and refuses to start
when nothing answers on `/api/version` — reading and signing in against the wrong branch is the one
mistake this script will not make quietly.

**And it refuses to measure a build that is not this tree.** `QA_ATLAS_BASE` names a port, and a dev
server on a contested port belongs to whoever started it, which is how the first v1.17.1 run produced
a document whose every number and screenshot was real — and about another card's commit. So before a
browser opens, `/api/version`'s `commit` must equal `git rev-parse HEAD` and its `version` must equal
the version being documented; a disagreement exits 2 and names both commits. What it agreed with is
written into `manifest.json` as `captureCommit`, and printed in the document beside the capture date
(#983).

## The check

```bash
pnpm qa:atlas:check
```

Static on purpose — no browser, no connection, nothing from `lib/db/**` — so it runs in the gate in
every lane. It fails, by route name, when:

- a route `data/pages/budget.ts` registers has no row in the current version's `manifest.json` (or the
  manifest carries a route the registry does not know), **or the tree's version has no atlas at all** —
  which is why a release cut carries one: bumping `package.json` without capturing turns the gate red,
  by design, and the step says which version is undocumented;
- a row's `expected` status disagrees with the boundary table, or a capture whose measured status
  differs is reported as anything other than a `fail` — publishing a real mismatch is the atlas's job,
  filing it as a pass is the contradiction the check refuses;
- a failing row carries no measured reason;
- a row's thumbnail is missing;
- a skipped row carries no reason;
- the `coverage` block is incomplete or disagrees with the rows beside it — a capture that stopped
  halfway used to commit as a whole one, because nothing read the block (#983);
- the manifest does not name the commit it captured (`captureCommit`) — "was this measured against
  the tree it claims?" is the question the document exists to answer;
- the atlas directory is over the 5 MB budget;
- the manifest documents a different version than `package.json` carries;
- **the tree holds more cuts than the retention window** — it names each cut to remove with its
  weight and the command that removes it (`pnpm qa:atlas:prune`), and it counts a cut that holds no
  `manifest.json`, because a directory the check cannot read is still weight someone committed.

Two files, no second route list: `scripts/qa-atlas-registry.mjs` derives the row set from
`data/pages/budget.ts` and reads the boundary out of `tests/parity/boundary.ts`;
`scripts/qa-atlas.mjs` captures and writes the document.

## Reading one

Each version directory holds `index.md` (the document), `manifest.json` (the machine-readable form the
check reads — not the markdown) and `thumbs/`. The index opens with the coverage line, then a row per
route: route · status · widths · thumbnail · verdict. The "changed this release" section diffs against
the previous atlas once there is one; the first atlas says so instead of showing an empty section.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › QA atlas · prev [v1.x UI cohort](../qa/v1x-ui-cohort/README.md) · next [QA atlas — v1.17.0](v1.17.0/index.md)

<!-- docs-nav:end -->
