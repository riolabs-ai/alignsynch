# The iteration rhythm: fast loop, cohort boundary

The full gate is **176 s**, and 108 s of that is `next build`. Paying it between two edits to a
component is what makes an hour of UI work feel like a day — so the gate is not the loop. It is the
**boundary**.

```
inner loop   ~30 s warm / ~90 s cold   pnpm check:fast   + look at the page
boundary     ~3 min                    bash scripts/verify.sh   + one push + one CI run + one merge
```

Measured on this tree: `tsc` is 7 s warm and **63 s cold**, `data:check` 15–22 s, the matched tests
5–10 s. So the honest figure is *30 s once the compiler has run in this checkout, around 90 s on the
first run after a fresh worktree* — against 176 s for the full gate, and without the 108 s build.

## A cohort

A cohort is a **branch that carries one kind of risk** and merges once.

- **UI/React cohorts are the default**: up to about ten changes — copy, layout, components, small
  client behaviour — on one branch, one gate, one PR, one merge.
- **Do not mix risk kinds in one cohort.** A branch that changes a component *and* a migration *and*
  an API route makes a red gate ambiguous, and the boundary is where ambiguity costs the most. If a
  change needs a migration or an API contract, it is its own cohort.
- **Keep a cohort to about a day.** The failure this replaces is real and measured: three of six
  cards in one session needed rebase-and-reapply because each outlived the `main` it was written
  against. A week-long cohort recreates that with interest.

```bash
git fetch origin --prune
git switch -c cohort/ui-<n> origin/main     # from the tip you just fetched, never a stale tree
```

## The inner loop

```bash
pnpm check:fast        # typecheck · data:check · the tests that import what you changed
```

It runs three things and skips the rest on purpose:

| step | why it stays | cost |
| --- | --- | --- |
| `typecheck` | hot reload lies about types; a broken import is a blank screen, not an error | ~7 s warm |
| `data:check` | E10 dead hrefs/assets · E21 pasted fixtures · **E34 a client module reaching `lib/db`** · E36 surface registry | ~15 s |
| `vitest`, matched by **import path** | the tests that actually exercise your change — filename conventions are loose here | ~5 s |

E34 is the one that earns the whole script: a `"use client"` module importing a *value* from server
code compiles, builds, passes every other check, and 500s every route behind the shell at request
time. `next build` will not tell you. That check will.

**Then look at the page.** For any UI change the screenshot is a required step, not a nicety: a
design was once merged on the strength of its headings and shipped six identical bordered boxes,
because every assertion was a string grep. Start the dev server, change the window width, and
look at what a person would see.

```bash
pnpm dev          # :3000, against the demo branch — never production
```

## The boundary

```bash
env -i HOME="$HOME" PATH="$(dirname "$(command -v node)"):/usr/local/bin:/usr/bin:/bin" TERM=dumb \
  bash scripts/verify.sh          # the full gate, in CI's environment
git push                          # one push → one CI run → one merge
```

- **Push from a clean environment.** An exported `DATABASE_URL` or `BILLING_PROVIDER` makes the gate
  judge the tree under production-ish conditions and fail for reasons that are not the diff. The
  `env -i` form above is CI's environment; `env -u DATABASE_URL` is not enough, because the
  pollution is a family of variables.
- **The pre-push hook runs the same gate.** Push once per cohort and you get the gate for free —
  there is no reason to `--no-verify`, and every reason not to.
- **Regenerate what is generated.** `docs/ui-registry.md` and `tests/parity/manifest.txt` are
  generated; a cohort that moves rendered output regenerates them (`node scripts/gen-ui-registry.mjs`,
  `pnpm parity:update --reason "…"`). Never hand-edit a hash to go green — a hash that moved for a
  reason is fine, a hash edited to match is a lie.
- **Order migrations before deploys.** A merged code path that reads a new column is useless — and on
  a page that queries it, broken — until `pnpm db:migrate` has run against the environment that
  serves it. `db:migrate` first, deploy second, verify the rendered page third.

## What is never skipped

- `typecheck` and `data:check` — cheap, and they catch the two failure classes that ship silently.
- A screenshot for a UI change.
- The gate at the boundary, and the migration ordering before any deploy.
- `git ls-remote` (or a PR link) as the proof a push actually happened.
