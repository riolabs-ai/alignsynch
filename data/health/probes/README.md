# `data/health/probes/` — evidence from a deliberately manipulated database

Nothing in this directory is platform health. Each file is the output of a check run against a
database that was **broken on purpose**, kept because it proves the check can see the break.

A probe result carries `exitCode: 1` and that is the point: it is the checker answering correctly.
It must never be copied into `data/health/platform-health.json`, because `/admin/health` reads that
record as the platform's status — a recorded exit 1 makes the dashboard read **Fail forever**, and a
real regression then hides inside the noise (#599).

The record is written by `pnpm health:record --db --gate` against **`demo`** and nothing else.

Since #680 that is enforced rather than remembered, in two directions:

- **A probe cannot write the platform record.** `pnpm health:record` refuses to measure a database
  whose Neon endpoint is not the demo branch's — a copy of `demo` has its own endpoint, which is what
  a probe branch is — and names this directory instead.
- **A probe run does not reach the platform writer at all.** `--probe <name>` writes
  `data/health/probes/<name>.json` and returns before the tree, the production probe or the gate are
  measured. The platform record's path is a different constant in `scripts/health-record.mjs`.

## Writing one

```bash
pnpm health:record --probe <name> --db \
  --database-label "scratch branch <what it was a copy of>, <how it was broken>" \
  --proves "<what a green run of this file would prove>"
```

`--probe` needs `--db` (evidence without a run proves nothing) and `--proves` (this file is read by a
person, later). `--issue` and `--kind` are optional. `--database-label` exists **only** in this mode:
the platform record's label is derived from the branch it read and then asserted, because a typed
label is how a scratch branch once recorded itself as platform status.

| File                              | What it proves                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `508-db-verify-probe-branch.json` | `db:verify` names the four rules it should (V11, V6, V7, V21) on a copy of `demo` with one instance deliberately broken — the #508 rule-coverage proof. |
