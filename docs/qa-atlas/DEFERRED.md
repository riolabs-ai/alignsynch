# Deferred sweeps

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › Deferred sweeps · prev [QA atlas](README.md) · next [QA atlas — v1.18.0](v1.18.0/index.md)

<!-- docs-nav:end -->

One row per release that shipped **without** a QA atlas sweep, and the reason in the owner's terms.
The check reads this file, so a version with no `manifest.json` either appears here or fails the
gate.

## Why a release may ship without a sweep

`pnpm qa:atlas:check` walked every route `data/pages/budget.ts` registers and failed whenever the
tree's version had no `docs/qa-atlas/<v>/manifest.json`. That is the right rule for a release whose
subject the atlas can see, and the wrong trade for one it cannot: the atlas captured no auth modal,
no stage-form embed steps and nothing for sign-in, sign-up or the Stripe flow, so a full sweep of
the registry could miss the very screens a release changed and still bill the release for it.

A sweep that cannot see the release's own subject must not block that release. It must not go
unnoticed either, which is what this page is for.

## What a row must say

| version | date | commit | reason |
| ------- | ---- | ------ | ------ |

Four fields, each checked by `scripts/qa-atlas-deferral.mjs`:

| field     | rule                                                                                                                                                                             |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version` | the bare semver `package.json` carries — `1.20.0`, with a `v` prefix tolerated. A row for another release cannot vouch for this one, and the check names the mismatch            |
| `date`    | a real `YYYY-MM-DD`. A record with no date cannot be read against the release it describes                                                                                       |
| `commit`  | the full 40-character lowercase sha of the release commit, **and that commit must exist**. A short hash is refused, and a sha nobody can resolve names no build                  |
| `reason`  | which surfaces the atlas cannot yet cover, in the owner's terms. Empty is refused, so is a placeholder (`n/a`, `none`, `no atlas`, `tbd`), and so is a cell under ten characters |

A row is written **when the release is cut**, naming the commit being tagged — not in advance.

## What a deferral does not buy

- **Silence.** A declared deferral passes the check, and the check prints it every run:
  `⚑ v1.20.0 deferred · <reason> — no atlas captures this release, and docs/qa-atlas/DEFERRED.md is
  the record of it`. Anyone reading a gate log knows this release has no sweep.
- **A weaker rule for a version that has a manifest.** The per-route rows, the boundary assertions,
  the coverage block and the `captureCommit` rule are untouched. A version that is both captured and
  deferred is a contradiction, and the check fails it by name: the row would keep saying the release
  shipped unmeasured after the sweep landed.
- **Room for the atlas tree.** Retention is a separate rule with a separate home
  (`qa-atlas-retention.mjs`): the current cut plus two past ones, one past while a kept cut is over
  4 MB. A deferral deletes nothing.

## The shape of the failure

A tree at `1.20.0` with no manifest and no row for `1.20.0` fails with the message it always had —
and, when the record carries rows for other releases, one line more:

```text
✗ qa:atlas:check — 2 problems for v1.20.0:
  ✗ docs/qa-atlas/v1.20.0/manifest.json is missing — the tree is v1.20.0 and no atlas documents it (run `pnpm qa:atlas` against the release cut)
  ✗ docs/qa-atlas/DEFERRED.md carries a deferral for v1.19.0, not for v1.20.0 — a row for another release cannot vouch for this one; add a row for this version, or capture it
```

The record is the only switch. There is no environment variable that turns the exemption on, and a
deleted record is not a deferral — it is a missing file, which `docs:check` fails by name because
this page is listed in the docs hub.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › Deferred sweeps · prev [QA atlas](README.md) · next [QA atlas — v1.18.0](v1.18.0/index.md)

<!-- docs-nav:end -->
