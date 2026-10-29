# quizhub

A Next.js 16 quiz platform (App Router + TypeScript + Tailwind). `content/` holds the zod
content model; `data/` holds the fixtures that satisfy it; `pnpm data:check` fails the build
when a fixture drifts. See `AGENTS.md` for the full command table and `docs/ENV-SPEC.md` for
the P1–P4 gate spec.

## Bulk fixture generation

`pnpm gen` emits bulk quiz fixtures from templates into `data/generated/` (gitignored), which
`pnpm data:check` validates when present. The output is reproducible and idempotent: the same
`--seed` produces byte-identical files, and a re-run without a seed change is a no-op.

```bash
pnpm gen --count 20 --seed 42   # emit 20 quizzes + their promotions to data/generated/
pnpm data:check                 # validates the generated records (E0–E19) when present
```
