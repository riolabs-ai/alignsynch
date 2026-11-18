# Deferred sweeps

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › Deferred sweeps · prev [QA atlas](README.md) · next [QA atlas — v1.19.0](v1.19.0/index.md)

<!-- docs-nav:end -->

One row per release that shipped **without** a QA atlas sweep, and the reason in the owner's terms.
The check reads this file, so a version with no `manifest.json` either appears here or fails the
check.

**Every sweep is deferred for this period, not just individual releases.** On 2026-11-15 the owner
stopped atlas generation and took `qa:atlas:check` out of the gate until the capture is refactored to
see what a release changes, so the question this page answers changes shape for a while: it is no
longer "did this release ship unmeasured?" but "no release is being measured at all". What that does
_not_ change is this page. The table below is still the record, a row is still written for a release
that ships without a sweep, and the four field rules below are still the rules the check applies. It
also does not make the check gratuitous: `pnpm qa:atlas:check` still runs by hand, and on a tree
whose version has no manifest and no row it still fails and names that version — what is gone is a
gate that fails everyone's push on it. Reactivation is the owner's request (#1094); the day it comes,
this paragraph goes and the per-release rule is the whole page again.

## Why a release may ship without a sweep

`pnpm qa:atlas:check` walked every route `data/pages/budget.ts` registers and failed whenever the
tree's version had no `docs/qa-atlas/<v>/manifest.json`. That is the right rule for a release whose
subject the atlas can see, and the wrong trade for one it cannot: the atlas captured no auth modal,
no stage-form embed steps and nothing for sign-in, sign-up or the Stripe flow, so a full sweep of
the registry could miss the very screens a release changed and still bill the release for it.

A sweep that cannot see the release's own subject must not block that release. It must not go
unnoticed either, which is what this page is for.

## What a row must say

| version     | date       | commit                                   | reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------- | ---------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.21.0      | 2026-11-16 | 1ce29064ce310905047e791fc00d1b54b3256b01 | no sweep for this release: generation is stopped until the atlas can see what a release changes (#1094), and it captures no auth modal, no stage-form embed step and nothing of the Stripe capture — which is where the session-state and invitation changes are read. The sha names the tree the release is cut from, because a commit cannot carry its own                                                                                                                                                                              |
| 1.22.0      | 2026-11-17 | 7eb8ed0dc57afc215dfed842ab3dc0e3d39faa90 | no sweep for this release, for the reason above and one more: the subjects are a signed-in surface the atlas can only reach with a demo session (`/dashboard/relationships/[id]` and its six tabs), a banner that only appears once a trial has lapsed, and the create wizard's rail — captured instead as a still of this tree's own detail page under `docs/qa/release-1.22.0/`. The sha names the tree the release is cut from, because a commit cannot carry its own                                                                  |
| 2.0.0-rc1   | 2026-11-17 | a560ea1cb211dfe275e5988f49bae20c93cda628 | no sweep for this release, for the reason above and one more: this candidate's subjects are the nine v2 surfaces — `/dashboard/templates`, `/dashboard/chat`, the relationship's Aspects and Payment tabs, `/pricing` and the public template catalogue — and the evidence it ships is a capture of eight of those routes under `docs/qa/release-2.0.0-rc1/`, taken from this tree rather than walked by the atlas. The sha names the tree the release is cut from (`origin/main` at prepare time), because a commit cannot carry its own |
| 2.0.0-rc1.2 | 2026-11-18 | 4b561cda44c0edd0f7cc051ad7844d096b5ee9ac | no sweep for this release, for the reason above and one more: it is the patch on the rc1.1 candidate, and the two surfaces it repairs are ones the atlas cannot reach — the create flow's stage 5, which needs a session that has just written a relationship, and the relationship detail's payment tab, which needs a completed engagement with a fee. The sha names the tree the release is cut from (`origin/main` at prepare time), because a commit cannot carry its own                                                            |

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

[Docs hub](../README.md) › **Records & QA** › Deferred sweeps · prev [QA atlas](README.md) · next [QA atlas — v1.19.0](v1.19.0/index.md)

<!-- docs-nav:end -->
