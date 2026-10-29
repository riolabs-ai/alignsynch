# quizhub

A Next.js 16 quiz platform (App Router + TypeScript + Tailwind). `content/` holds the zod
content model; `data/` holds the fixtures that satisfy it; `pnpm data:check` fails the build
when a fixture drifts. See `AGENTS.md` for the full command table and `docs/ENV-SPEC.md` for
the P1–P4 gate spec.

## Images: optimization is off on purpose

`next.config.mjs` sets `images.unoptimized: true` (issue #6). This is a decision, not an
oversight, and the flag carries a comment explaining it. In short: there is no deploy target
(P4), so there is no origin for `/_next/image` to pay for itself; turning optimization on makes
the request path depend on `sharp`, which is only `next`'s _optionalDependency_ (a platform
binary) and is never exercised by `scripts/verify.sh`, which runs `next build` and never
`next start` plus an image fetch — so it would fail as a 500 on every image while the gate stayed
green.

It also cannot pay off yet: 21 of the 57 `<Image>` tags use `fill` and none passes `sizes`, so
optimized output falls back to `sizes="100vw"` with a `w=3840` candidate for a ~340 px tile.
`fill` tags need `sizes` before the flag can come off.

Known call-site bugs that `unoptimized` currently hides, all of them dev-only 500s because
`next/image`'s dimension check sits inside `NODE_ENV !== "production"`: two tags with no
dimension source at all (`components/home/player-testimonials.tsx`,
`components/settings/security-settings.tsx`) and three that pass `fill` together with
`width`/`height` (`components/dashboard/my-quizzes-dashboard.tsx`,
`components/profile/profile-created-quizzes.tsx`). No route renders them today — they sit behind
a toggle, an unreached fallback and tab state — which is why `pnpm dev` is still 200 everywhere.

## Bulk fixture generation

`pnpm gen` emits bulk quiz fixtures from templates into `data/generated/` (gitignored), which
`pnpm data:check` validates when present. The output is reproducible and idempotent: the same
`--seed` produces byte-identical files, and a re-run without a seed change is a no-op.

```bash
pnpm gen --count 20 --seed 42   # emit 20 quizzes + their promotions to data/generated/
pnpm data:check                 # validates the generated records (E0–E19) when present
```
