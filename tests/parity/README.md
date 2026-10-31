# Brand parity — a hash manifest and a summary, not 1.4 MB of HTML

Both brands render seven routes. Each render is reduced to a SHA-256 and to a structural summary,
and those two small files are what is committed (#171). A second assertion, over a longer list,
covers the boundary between the two products: the routes the quiz product owns answer 200 on
QuizHub and 404 on AlignSynch (#300).

```
tests/parity/
  routes.ts              the seven snapshot routes, and the fixture id each dynamic one is rendered with
  boundary.ts            the twenty-two quiz-only routes — the status list, not a snapshot
  harness.ts             the render (page inside the real shell), the clock freeze, the normalisation
  summary.ts             the structural summary: headings, landmarks, link targets, counts
  parity.check.ts        one process per brand; compares, or rewrites in update mode
  manifest.txt           generated — route | brand | sha256, 14 lines
  summaries/<brand>/     generated — what a reviewer reads in a diff
  artifacts/             gitignored — full HTML of a render that did NOT match
```

## Running it

```bash
pnpm parity                                       # both brands, ~13–18 s — a step of verify.sh
pnpm parity:update --reason "brand header copy on /news"   # rewrite manifest + summaries
```

`pnpm parity:update` refuses to run without a `--reason` (or `PARITY_REASON`). The reason is the
sentence the PR has to carry; the command prints the routes it moved so the sentence can be
specific:

```
manifest rewritten — put this in the PR:
  changed  quizhub    /news  4b1c0a9d7e21 → 9f2ab0c31d44
  changed  alignsynch /news  71c0e5ba2288 → 0d5c19ab77f1

  reason: brand header copy on /news
```

`pnpm test` skips this suite on purpose (`PARITY_BRAND` unset): a brand is a build constant, so
both brands need one process each, and `scripts/parity.mjs` is what spawns them.

## What a failure looks like

```
✗ alignsynch /leaderboard drifted: rendered 4b1c…, manifest says 9f2a….
  A rendered byte changed. … Render: tests/parity/artifacts/alignsynch/leaderboard.html ·
  summary: tests/parity/artifacts/alignsynch/leaderboard.summary.txt
```

It names the route and the brand, prints both hashes, and writes the full normalised HTML it
hashed to `tests/parity/artifacts/<brand>/<route>.html`. That directory is gitignored and is
uploaded by CI (`parity-artifacts-<brand>`) when a leg fails — the render, not a re-render, so the
bytes in the artifact are the bytes that were hashed.

The committed `summaries/<brand>/<route>.txt` is compared too. A summary that no longer matches its
own render is a stale generated file, not a mystery: the same `pnpm parity:update` rewrites both.

## A route that is switched off is pinned as a 404, not dropped

`/leaderboard` is in the list and currently renders nothing: `community.leaderboard` is off in
`data/flags.ts` (#175), so the page calls `notFound()` before reading anything. The route declares
that in `routes.ts` (`disabledByFlag`), and the suite asserts both halves — the resolver says off,
and the page really throws Next's not-found:

```
route  /leaderboard
brand  alignsynch

outcome  404 — community.leaderboard is off (data/flags.ts)
```

The declared 404 is what the manifest hashes, so turning the flag on moves the hash and turns the
summary into a rendered page: a reviewer gets that decision instead of a surface quietly vanishing
from the list. Only a route that _names_ its flag may 404 — any other not-found (a fixture that
stopped resolving) still fails the run, which is the guard that keeps a broken page from being
pinned as "absent".

## The brand boundary — a second assertion, over a longer list (#300)

The seven routes above ask _what does this page render_. They never asked _does this brand serve
this page at all_, and that gap is how fifty-two statements about quizzes were served under the
AlignSynch name: every quiz surface answered 200 on a build that does not sell quizzes.

`boundary.ts` is the list — twenty-two routes the quiz product owns (the catalogue, a quiz and its
two views, the authoring pair, an author's own quizzes, tournaments, battle, the daily challenge,
creator tips, discussions, chat and the quiz dashboard). `parity.check.ts` walks it per brand and
asserts a **status**, not a hash:

| brand      | this build ships the quiz product | every route on the list           |
| ---------- | --------------------------------- | --------------------------------- |
| quizhub    | yes                               | renders (not a 404)               |
| alignsynch | no                                | `404` via `product.quiz-surfaces` |

Two outcomes, and the difference between them is the test: `"render"` is a page that produced a
tree, `"error: …"` is a page that threw something else. A route that threw for its own reasons has
not shown that it serves the surface, so the quiz-brand leg requires `"render"` and fails on
anything else. The one documented exception is `/dashboard/user`, which resolves a session this
process does not have — its gate is still asserted on the alignment brand and its 200 is on the
`curl` table the PR carries.

`/leaderboard` is **not** on the list even though it is a quiz surface: it answers 404 on both
brands because its own flag is off, so it cannot express the boundary. It keeps `disabledByFlag`,
which is the honest statement of what closes it.

`/quiz/[id]` is on both lists. On the quiz brand it is hashed like any page; on the alignment brand
its committed artifact is the declared 404 — the summary line reads `product.quiz-surfaces is off
on the alignsynch build`, which is a different sentence from the flag case on purpose, because the
two 404s are different facts.

Nothing about this widens the hash set: the manifest is still the fourteen `route | brand` lines of
the seven snapshot routes, and the boundary is a status assertion over its own list. The one line
that moves when the boundary is introduced is `/quiz/[id] | alignsynch`.

## Why a hash and a summary, and not HTML

Fourteen full-page snapshots were 1.4 MB (`/` alone 327 KB). They caught drift — and every card
that touched a shared class, a shared string or one of the seven routes had to regenerate them,
producing a 300 KB diff and HTML merge conflicts nobody should resolve by hand. The detector did
not need to be readable to work; the reviewer needed something readable.

So the split is:

| Committed                                   | Size    | Job                                                     |
| ------------------------------------------- | ------- | ------------------------------------------------------- |
| `manifest.txt`                              | ~1.8 KB | the detector: one `route \| brand \| sha256` per line   |
| `summaries/<brand>/<route>.txt`             | ~28 KB  | the reviewer's view: headings, landmarks, links, counts |
| `artifacts/` (on failure only, CI-uploaded) | ~300 KB | the ground truth when the summary is silent             |

A class rename moves the hash and the class fingerprint in the summary; a copy edit moves the hash
and the heading text; a new link moves the hash and one line of `links`. Nothing is masked, so a
hash change is always a real change.

## What is covered, and what is faked

Covered: the page inside the real `(mainlayout)` shell — every string, class, href, src and aria
attribute the browser receives, for both brands, on `/`, `/leaderboard`, `/news`, `/news/[slug]`,
`/quiz/[id]`, `/assessment/avery-rowan` and `/profile/[username]`.

Four boundaries, all stated in full in `harness.ts`:

| Boundary                           | Because                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `next/image` → plain `<img>`       | Next's component needs the Next runtime for its srcset, and throws on a missing `width` (a `/` defect that predates this gate)        |
| `next/navigation` → stub           | no router exists in a node process; `usePathname` answers the route under test, `notFound` stays the real function                    |
| `/assessment/[slug]` → fixtures    | it reads Postgres at request time, and the gate has no `DATABASE_URL` by design (`AGENTS.md`); the fixtures are what `db:seed` writes |
| `app/layout.tsx` → wrapper `<div>` | the root layout imports `next/font/google` and `globals.css`, which only a Next build resolves                                        |

The real `next build` covers the first boundary from the other side: it compiles both brands in CI
(`typecheck / lint / build (quizhub)` and `… (alignsynch)`).

## Determinism — what had to be pinned, and why

A hash is only a gate if the same tree produces the same bytes on every machine. Three inputs are
therefore fixed rather than inherited:

- **the clock** — `harness.ts::freezeClock()` freezes `Date` at `content/core.ts`'s `DEMO_NOW_ISO`.
  Nothing is masked: the quiz countdown and the footer year are the same on every run because the
  instant is, so the format and the value are both part of the hash.
- **`TZ=UTC`** — `content/core.ts` formats with an explicit `timeZone: "UTC"`, but anything that
  fell back to the host zone would render differently on a laptop and on a UTC runner.
- **the locale** — `scripts/parity.mjs` sets `LANG`/`LC_ALL` to `en_US.UTF-8`. Pages call bare
  `toLocaleString()` on counts, which reads the _default_ locale: `de_DE` renders `1.234.567`,
  a runner with no `LANG` resolves to `und`, and `en_US` gives `1,234,567`. Pinning makes the
  render independent of whoever's shell ran it.

Both brands' names are the only strings that differ by design, and every route asserts it carries
its own brand's name and not the other's — before any hash is compared.

## Updating is a review event, not a refresh

Run `pnpm parity:update --reason "…"` when a rendered change is **intended**, and put the printed
list and the reason in the PR. If the reason is "the hash was in the way", the change is not
intended yet: find out what moved it first. Never widen the harness or add a mask to make a hash
match.
