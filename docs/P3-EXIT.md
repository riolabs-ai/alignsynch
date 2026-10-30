# P3 exit record — bulk generation / variation

**Status: PASS** · verified on `main` @ `f5e1b00a` · 2026-10-30

Gate definition (`docs/ENV-SPEC.md` §5):

> **P3 — bulk generation / variation.** A generator emits N variants from templates and validates
> them with the same schema. _Exit:_ `npm run gen -- --count 20 --seed 42` produces reproducible,
> schema-valid fixtures; re-running is idempotent.

## Evidence

Every row is a command that was run against this commit; nothing here is inferred.

| Criterion                              | Command                                         | Result                                                                                     |
| -------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Emits N variants                       | `npm run gen -- --count 20 --seed 42`           | `wrote 20 quizzes … (seed=42, count=20)`                                                   |
| Reproducible                           | run twice, hash `data/generated/*`              | both runs `bb065e9c…b2e8` — **identical**                                                  |
| Idempotent                             | same command, second time                       | `unchanged — already matches seed=42 count=20 (no rewrite)`                                |
| Seed actually varies output            | `npm run gen` (default `seed=1`)                | rewrote the directory — different seed, different bytes                                    |
| Same schema, no forked validator       | `pnpm data:check`                               | exit 0, and the PASS line counts **`20 generated quizzes`** alongside the 62 authored ones |
| Generated output never enters the tree | `git check-ignore -v data/generated/quizzes.ts` | `.gitignore:42:data/generated/`                                                            |

The `data:check` PASS line for this commit:

```
PASS  62 quizzes, 271 questions, 9 news, 6 tips, 8 kb, 45 categories, 5 contacts,
      5 conversations, 6 notifications, 2 promotions, 17 quiz results, 14 comments,
      5 reviews, 99 media entries, 21 page-copy routes, 2 battle modes,
      6 daily-challenge badges, 10 players, 50 leaderboard rows, 8 wins,
      74 search rows, 20 generated quizzes
```

## What P3 added

- `scripts/gen-fixtures.mjs` (+ tests) — template-driven emitter, PRNG seed, `--count` / `--seed` / `--out`.
- `data/generated/` as the only writer target, gitignored, validated when present.
- Authored `data/` is never overwritten: the generator refuses to touch it, and a test asserts a
  stale `promotions.ts` left by an older generator is removed rather than merged.

## Invariants now enforced by the gate

`E1 E2 E10 E11 E14 E15 E16 E17 E21 E22 E23 E24 E28 E29 E45 E96` — the set that accumulated across
P1 and P2 (schema shape, promotion windows, slot joins, taxonomy selectors, copy ratcheting, media
registry both-directions, metric computability, image dimensions).

## Gate cost at exit

- CI `typecheck / lint / build`: **76–79 s**, all green on the last four `main` runs.
- Lanes: `docs` · `content` · `config` · `code`, resolved from the diff against `origin/main`
  (`scripts/verify.sh` header). A content-only change never builds Next.
- At most **2** concurrent `next build`s (`QUIZHUB_BUILD_SLOTS`, default 2) — eight workers
  compiling in parallel previously took load average to 39.5 on this box.

## Deliberately not done at P3

- **No database, no auth, no deploy** — still hard non-goals until after P4.
- **No tournament domain.** WU-11 rendered tournament copy through `PageCopy` and left the domain
  out (`docs/DATA-MODEL.md` unchanged, no Tournament entity). That decision is recorded in #58.
- **No second vertical.** P4 owns that, and it starts with a decision, not a card.

## P4 entry criteria

1. Choose the second vertical (eLearning, assessments, or another) and write its projection over
   the existing schema — if it needs new entities, that is a P4 schema unit, not a retrofit.
2. Prove the abstraction: the second vertical renders from the same `content/` schema and
   `data/` fixtures, with **no edit to Quizhub's screens**.
3. Keep the generator: variants for the new vertical come from `npm run gen`, not from a second
   one-off script.
