# `data/health/probes/` — evidence from a deliberately manipulated database

Nothing in this directory is platform health. Each file is the output of a check run against a
database that was **broken on purpose**, kept because it proves the check can see the break.

A probe result carries `exitCode: 1` and that is the point: it is the checker answering correctly.
It must never be copied into `data/health/platform-health.json`, because `/admin/health` reads that
record as the platform's status — a recorded exit 1 makes the dashboard read **Fail forever**, and a
real regression then hides inside the noise (#599).

The record is written by `pnpm health:record --db` against **`demo`** and nothing else.

| File                              | What it proves                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `508-db-verify-probe-branch.json` | `db:verify` names the four rules it should (V11, V6, V7, V21) on a copy of `demo` with one instance deliberately broken — the #508 rule-coverage proof. |
