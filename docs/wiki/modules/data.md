# Module: `data`

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Code wiki** › data · prev [content](content.md) · next [lib/admin](lib-admin.md)

<!-- docs-nav:end -->

38 TypeScript modules holding the fixtures — the authored content every product route projects. The
database is a mirror of this directory, never the other way round: `pnpm db:seed` reads
[`assessments.ts`](../../../data/assessments.ts), and nothing derives a fixture from a row.

## Responsibilities

- Hold the content: quizzes, assessments, articles, news, creator tips, the knowledge base, social
  posts, promotions, search rows, the template shelf and the copy fixtures in `pages/`.
- Hold the **brand** record ([`brand.ts`](../../../data/brand.ts)) — the only home of the palette, the
  wordmark and the product flags a template claims.
- Export projections, never authored card arrays: a shelf draws `selectQuizCard(row, campaign, now)`.
- Stay valid. `pnpm data:check` is the contract, and it runs before `pnpm build` in the gate.

## Key files

- [`assessments.ts`](../../../data/assessments.ts) — templates and the seeded instances. The one file
  `pnpm db:seed` reads.
- [`quizzes.ts`](../../../data/quizzes.ts) — the public quiz collection.
- [`quiz-catalogue.ts`](../../../data/quiz-catalogue.ts) — `slotShelves`, the campaign slots the
  catalog renders; E17 fails a promotion naming a slot this file does not render.
- [`promotions.ts`](../../../data/promotions.ts) — curated campaign overlays, one per slot. Never
  generated: `pnpm gen` deletes a generated promotions file and E26 rejects it.
- [`brand.ts`](../../../data/brand.ts) — both brands' palettes and wordmarks.
- [`flags.ts`](../../../data/flags.ts) — the flag store resolved by [`lib/flags.ts`](../../../lib/flags.ts).
  `product.quiz-surfaces` (`default: false`, `templates: ["quizhub"]`) is the brand boundary's switch.
- [`bundles/demo-dataset.alignsynch.json`](../../../data/bundles/demo-dataset.alignsynch.json) — the
  canonical export of the demo dataset, held equal to the fixtures by E32.
- [`verify/demo-expectations.json`](../../../data/verify/demo-expectations.json) — the row counts and
  nine rendered answers `pnpm demo:verify` diffs against.

## Public API

Fixtures are exported collections and lookups (`quizzes`, `quizzesFor`, `slotShelves`, `pages`), plus
the copy modules under `pages/` that a page parses on the server and hands down as props. A new
surface adds a module here and a row in `data/pages/budget.ts`; a fixture with no consuming page is an
E37/E39 finding, not dead code.

## Internal structure

- **collections** — one file per content family, each an array satisfying a `content/` schema.
- **`pages/`** — one module per surface, holding the sentences that surface renders. A page reads
  these; a component never holds copy of its own.
- **`brands/`** — per-brand asset records.
- **`v1/`** — the retired prototype's fixtures, kept for reference.
- **`generated/`** — gitignored; `pnpm gen` writes quizzes there and the active assessment set when a
  bundle is imported.

## Dependencies

- **Used by:** every page, [`lib/`](../../../lib) projections, `scripts/db-seed.mjs`,
  `scripts/gen-media.mjs`, `scripts/bundles.ts`.
- **Uses:** [`content/`](content.md) for types and derivations, and assets under
  [`public/`](../../../public).

## Notable patterns / gotchas

- **A fixture edit is a three-step change:** edit, `pnpm data:check`, and — if the record is seeded —
  `pnpm db:seed && pnpm db:verify`. The gate will not tell you the database drifted.
- **The census is currently zero warnings.** A non-zero `W` count is a regression, and no date,
  question or reward window is invented to silence one.
- **`data:check` reads the UI tree, not just this directory.** E10 matches every literal `href` and
  `public/` asset against the route manifest; E21 fails a fixture row pasted into a component; E37
  fails reader-visible copy that names the template on a surface the alignment build renders.
- **A snapshot key is a harness label, not a shelf position.** `scripts/__tests__/fixtures/card-records.ts`
  keys its rows `explore-page/*` and `explore-featured/*`, and those two groups are the opposite way
  round from the pages that render them.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Code wiki** › data · prev [content](content.md) · next [lib/admin](lib-admin.md)

<!-- docs-nav:end -->
