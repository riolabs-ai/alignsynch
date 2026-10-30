# Brand parity snapshots

Both brands render seven routes; each render is committed and compared byte for byte (#171).

```
tests/parity/
  routes.ts            the seven routes, and the fixture id each dynamic one is rendered with
  harness.ts           the render (page inside the real shell) and the normalisation
  parity.test.ts       one process per brand; compares, or rewrites in update mode
  snapshots/<brand>/   generated — do not edit by hand
```

## Running it

```bash
pnpm parity          # both brands, ~15 s — this is a step of bash scripts/verify.sh
pnpm parity:update   # rewrite the snapshots and print which routes moved
```

`pnpm test` skips this suite on purpose (`PARITY_BRAND` unset): a brand is a build constant, so
both brands need one process each, and `scripts/parity.mjs` is what spawns them.

## Updating a snapshot is a review event, not a refresh

Run `pnpm parity:update` when a rendered change is **intended**, and say in the PR:

- which routes moved (the command prints them), and
- why.

A reviewer reads that sentence, not the diff — 300 KB of HTML has no reviewer. If the reason is
"the snapshot was in the way", the change is not intended yet: find out what moved it first.

## What is covered, and what is masked

Covered: the page inside the real `(mainlayout)` shell — every string, class, href, src and
aria attribute the browser receives, for both brands, on `/`, `/leaderboard`, `/news`,
`/news/[slug]`, `/quiz/[id]`, `/assessment/avery-rowan` and `/profile/[username]`.

Masked: **nothing.** The clock is frozen at `content/core.ts`'s `DEMO_NOW_ISO` instead, so the
quiz countdown and the footer year are the same on every run rather than replaced by a pattern,
and the snapshot pins their format as well as their value. The two brands' names are the only
strings that differ by design, and each snapshot is asserted to carry its own and not the
other's.

Not covered, and why — the four boundaries are stated in full in `harness.ts`:

| Boundary                           | Because                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `next/image` → plain `<img>`       | Next's component needs the Next runtime for its srcset, and throws on a missing `width` (a `/` defect that predates this gate)        |
| `next/navigation` → stub           | no router exists in a node process; `usePathname` answers the route under test, `notFound` stays the real function                    |
| `/assessment/[slug]` → fixtures    | it reads Postgres at request time, and the gate has no `DATABASE_URL` by design (`AGENTS.md`); the fixtures are what `db:seed` writes |
| `app/layout.tsx` → wrapper `<div>` | the root layout imports `next/font/google` and `globals.css`, which only a Next build resolves                                        |

The real `next build` covers the first boundary from the other side: it compiles both brands in
CI (`typecheck / lint / build (quizhub)` and `… (alignsynch)`).

## Why a snapshot and not an assertion

The other tests in `tests/` assert a projection: a copy object, a card model, a route's wiring.
None of them can see that a component stopped reading `brand`, or that a palette settled on one
skin, or that a shared string moved under the other brand. A snapshot is the only assertion that
covers "the whole document, unchanged" without naming each thing that must not change — and it
fails with a line diff, which is what makes it actionable.
